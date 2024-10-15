import { GAME_TILEMAPS } from "$lib/crossover/defs";
import {
    entityInRange,
    getEntityId,
    minifiedEntity,
} from "$lib/crossover/utils";
import { isItemEquipped } from "$lib/crossover/world/compendium";
import { TILE_HEIGHT, TILE_WIDTH } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    geohashLocationTypes,
    type EquipmentSlot,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import type { WorldPOIs } from "$lib/crossover/world/world";
import {
    type ActorEntity,
    type CreatureEntity,
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { substituteVariablesRecursively } from "$lib/utils";
import { setEntityBusy } from "..";
import { performAbility } from "../abilities";
import { worldAssetMetadataCache, worldPOIsCache } from "../caches";
import { spawnItemInInventory, spawnWorld, spawnWorldPOIs } from "../dm";
import { publishAffectedEntitiesToPlayers, publishFeedEvent } from "../events";
import { itemRepository } from "../redis";
import { getNearbyPlayerIds, inventoryQuerySet } from "../redis/queries";
import { fetchEntity, saveEntity } from "../redis/utils";
import {
    canConfigureItem,
    canUseItem,
    itemVariableValue,
    parseItemVariables,
} from "../utils";

export {
    configureItem,
    createItem,
    dropItem,
    enterItem,
    equipItem,
    takeItem,
    unequipItem,
    useItem,
};

/**
 * Uses an item by performing the specified utility on the target entity.
 *
 * @param params.item - The item to be used.
 * @param params.utility - The utility to perform on the item.
 * @param params.self - The entity using the item.
 * @param params.target - The target entity for the utility (optional).
 * @returns A promise that resolves to the updated item entity.
 */
async function useItem({
    item,
    utility,
    self,
    target,
    now,
}: {
    item: string;
    utility: string;
    self: CreatureEntity;
    target?: string; // target can be an `item`
    now?: number;
}) {
    now = now ?? Date.now();
    let error: string | null = null;
    let targetEntity = target ? await fetchEntity(target) : undefined;
    let itemEntity = (await fetchEntity(item)) as ItemEntity;
    // Get target
    if (target && !targetEntity) {
        error = `Target ${target} not found`;
    }
    // Get item
    else if (itemEntity == null) {
        error = `Item ${item} not found`;
    }
    // Check if can use item
    else {
        const { canUse, message } = canUseItem(self, itemEntity, utility);
        if (!canUse) {
            error = message;
        }
    }

    if (error) {
        if (self.player) {
            await publishFeedEvent((self as PlayerEntity).player, {
                type: "error",
                message: error,
            });
        }
        return; // do not proceed
    }

    const prop = compendium[itemEntity.prop];
    const propUtility = prop.utilities[utility];
    const propAbility = propUtility.ability;
    const nearbyPlayerIds = await getNearbyPlayerIds(
        self.loc[0],
        self.locT as GeohashLocation,
        self.locI,
    );

    if (itemEntity.state !== propUtility.state.start) {
        // Set item start state
        itemEntity.state = propUtility.state.start;
        itemEntity = (await itemRepository.save(
            itemEntity.item,
            itemEntity,
        )) as ItemEntity;

        // Publish item state to nearby players
        if (self.player != null) {
            await publishAffectedEntitiesToPlayers(
                [minifiedEntity(itemEntity)],
                {
                    publishTo: nearbyPlayerIds,
                },
            );
        }
    }
    // Perform ability (ignore cost when using items)
    if (propAbility) {
        // Overwrite target if specified in item variables
        if (prop.variables.target) {
            targetEntity = (await itemVariableValue(
                itemEntity,
                "target",
            )) as ActorEntity;
            target = getEntityId(targetEntity)[0];
        }

        // Overwrite self if specified in item variables (can only be `player` or `monster`)
        if (prop.variables.self) {
            self = (await itemVariableValue(itemEntity, "self")) as
                | PlayerEntity
                | MonsterEntity;
        }

        if (target) {
            await performAbility({
                self,
                target,
                ability: propAbility,
                ignoreCost: true, // ignore cost when using items
                now,
            });
        }
    }

    // Set item end state, consume charges and durability
    itemEntity.state = propUtility.state.end;
    itemEntity.chg -= propUtility.cost.charges;
    itemEntity.dur -= propUtility.cost.durability;
    itemEntity = (await itemRepository.save(
        itemEntity.item,
        itemEntity,
    )) as ItemEntity;

    // Publish item state to nearby players
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(itemEntity, { stats: true })],
        {
            publishTo: nearbyPlayerIds,
        },
    );
}

async function equipItem(
    player: PlayerEntity,
    item: string,
    slot: EquipmentSlot,
    now?: number,
) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.equip.action,
        now: now,
    })) as PlayerEntity;

    let itemToEquip = (await fetchEntity(item)) as ItemEntity;
    const slots = compendium[itemToEquip.prop].equipmentSlot;
    let error: string | null = null;

    if (itemToEquip == null) {
        error = `Item ${item} not found`;
    } else if (itemToEquip.loc[0] !== player.player) {
        error = `${item} is not in inventory`;
    } else if (slots == null) {
        error = `${item} is not equippable`;
    } else if (!slots.includes(slot)) {
        error = `${item} cannot be equipped in ${slot}`;
    }

    if (error != null) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: error,
        });
        return; // do not proceed
    }

    // Unequip existing item in slot
    const exitingItemsInSlot = (await inventoryQuerySet(player.player)
        .and("locT")
        .equal(slot)
        .return.all()) as ItemEntity[];
    for (let itemEntity of exitingItemsInSlot) {
        itemEntity.loc = [player.player];
        itemEntity.locT = "inv";
        (await itemRepository.save(itemEntity.item, itemEntity)) as ItemEntity;
    }

    // Equip item in slot
    itemToEquip.loc = [player.player];
    itemToEquip.locT = slot;
    itemToEquip = (await itemRepository.save(
        itemToEquip.item,
        itemToEquip,
    )) as ItemEntity;

    // Inform all players nearby of equipment change
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocation,
        player.locI,
    );
    await publishAffectedEntitiesToPlayers(
        [itemToEquip, ...exitingItemsInSlot].map((e) => minifiedEntity(e)),
        {
            publishTo: nearbyPlayerIds,
        },
    );
}

async function unequipItem(player: PlayerEntity, item: string, now?: number) {
    let itemEntity = (await fetchEntity(item)) as ItemEntity;

    if (itemEntity == null) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        return;
    }

    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.unequip.action,
        now,
    })) as PlayerEntity;

    // Check item is on player
    if (itemEntity.loc[0] !== player.player) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not equipped`,
        });
        return;
    }

    // Unequip item
    itemEntity.loc = [player.player];
    itemEntity.locT = "inv";
    itemEntity = (await itemRepository.save(
        itemEntity.item,
        itemEntity,
    )) as ItemEntity;

    // Inform all players nearby of equipment change
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocation,
        player.locI,
    );
    await publishAffectedEntitiesToPlayers([minifiedEntity(itemEntity)], {
        publishTo: nearbyPlayerIds,
    });
}

async function takeItem(player: PlayerEntity, item: string, now?: number) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.take.action,
        now: now,
    })) as PlayerEntity;

    let error: string | null = null;

    // Get item
    let itemEntity = (await fetchEntity(item)) as ItemEntity;
    if (itemEntity == null) {
        error = `Item ${item} not found`;
    }
    // Check item owner is player or public
    else if (itemEntity.own !== player.player && itemEntity.own) {
        error = `${item} is owned by someone else`;
    }
    // Check if in range
    else if (!entityInRange(player, itemEntity, actions.take.range)[0]) {
        error = `${item} is not in range`;
    }
    // Check if item is takeable
    else if (compendium[itemEntity.prop].weight < 0) {
        error = `${item} cannot be taken`;
    }

    if (error) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: error,
        });
        return; // do not proceed
    }

    // Take item
    itemEntity.loc = [player.player];
    itemEntity.locT = "inv";
    itemEntity = (await itemRepository.save(
        itemEntity.item,
        itemEntity,
    )) as ItemEntity;

    // Inform all players nearby of item creation
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocation,
        player.locI,
    );
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(itemEntity, { stats: true })],
        { publishTo: nearbyPlayerIds },
    );
}

async function dropItem(player: PlayerEntity, item: string, now?: number) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.drop.action,
        now: now,
    })) as PlayerEntity;

    // Get item
    let itemEntity = (await fetchEntity(item)) as ItemEntity;
    if (itemEntity == null) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        return;
    }

    // Check item is on player
    if (itemEntity.loc[0] !== player.player) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not in inventory`,
        });
        return;
    }

    // Check can't drop equipped item
    if (isItemEquipped(itemEntity, player)) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `Can't drop equipped ${item}, unequip it first`,
        });
        return;
    }

    if (!geohashLocationTypes.has(player.locT)) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `You cannot drop ${item} here`,
        });
        return;
    }

    // Drop item
    itemEntity.loc = player.loc;
    itemEntity.locT = player.locT;
    itemEntity.locI = player.locI;
    itemEntity = (await itemRepository.save(
        itemEntity.item,
        itemEntity,
    )) as ItemEntity;

    // Inform all players nearby of item creation
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocation,
        player.locI,
    );
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(itemEntity, { stats: true })],
        { publishTo: nearbyPlayerIds },
    );
}

async function createItem(
    player: PlayerEntity,
    prop: string,
    variables?: Record<string, string | number | boolean>,
    now?: number,
) {
    // Set busy
    player = await setEntityBusy({
        entity: player,
        action: actions.create.action,
        now: now,
    });

    try {
        // Create item in player inventory
        const item = await spawnItemInInventory({
            entity: player,
            prop,
            variables,
            owner: player.player, // owner is player
            configOwner: player.player,
        });
        await publishAffectedEntitiesToPlayers(
            [minifiedEntity(item, { stats: true })],
            { publishTo: [player.player] },
        );
    } catch (error: any) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: error.message,
        });
    }
}

async function configureItem(
    player: PlayerEntity,
    item: string,
    variables: Record<string, string | number | boolean>,
    now?: number,
) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.configure.action,
        now: now,
    })) as PlayerEntity;

    // Get item
    let itemEntity = (await fetchEntity(item)) as ItemEntity;
    if (itemEntity == null) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        return; // do not proceed
    }

    // Check in range
    if (!entityInRange(player, itemEntity, actions.configure.range)[0]) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not in range`,
        });
        return; // do not proceed
    }

    // Check if can configure item
    const { canConfigure, message } = canConfigureItem(player, itemEntity);
    if (!canConfigure) {
        await publishFeedEvent(player.player, {
            type: "error",
            message,
        });
        return; // do not proceed
    }

    // Save item with updated variables
    itemEntity.vars = {
        ...itemEntity.vars,
        ...parseItemVariables(variables, itemEntity.prop),
    };
    itemEntity = (await itemRepository.save(
        itemEntity.item,
        itemEntity,
    )) as ItemEntity;

    // Publish update event
    await publishAffectedEntitiesToPlayers([minifiedEntity(itemEntity)], {
        publishTo: [player.player],
    });
}

async function enterItem(
    player: PlayerEntity,
    item: string,
    now?: number,
): Promise<{ player: PlayerEntity; pois: WorldPOIs }> {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.enter.action,
        now: now,
    })) as PlayerEntity;

    // Get item
    let itemEntity = (await fetchEntity(item)) as ItemEntity;
    if (itemEntity == null) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        throw new Error(`Item ${item} not found`);
    }

    // Check in range
    if (!entityInRange(player, itemEntity, actions.enter.range)[0]) {
        await publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not in range`,
        });
        throw new Error(`${item} is not in range`);
    }

    // Check if can item can be entered
    const prop = compendium[itemEntity.prop];
    if (!prop.world) {
        const message = `${itemEntity.name} is not something you can enter`;
        await publishFeedEvent(player.player, {
            type: "error",
            message,
        });
        throw new Error(message);
    }
    if (!geohashLocationTypes.has(itemEntity.locT)) {
        const message = `${itemEntity.item} is not in this world`;
        await publishFeedEvent(player.player, {
            type: "error",
            message,
        });
        throw new Error(message);
    }

    // Substitute world variables
    const { locationInstance, geohash, world, uri, locationType } =
        substituteVariablesRecursively(prop.world as any, {
            ...itemEntity.vars,
            self: itemEntity,
        });

    const url = uri.startsWith("http") ? uri : `${GAME_TILEMAPS}/${uri}`;

    // Spawn world (only if not exists)
    await spawnWorld({
        world, // specify the worldId manually, if the world already exists it will fetch it without spawning
        geohash,
        locationType: locationType as GeohashLocation,
        assetUrl: url,
        tileHeight: TILE_HEIGHT, // do not change this
        tileWidth: TILE_WIDTH,
    });

    // Spawn world POIs
    const { pois } = await spawnWorldPOIs(world, locationInstance, {
        worldAssetMetadataCache: worldAssetMetadataCache,
        worldPOIsCache: worldPOIsCache,
        source: itemEntity,
    });

    // Check for player spawn point (use world geohash as fall back)
    const playerSpawnPOI = pois.find(
        (p) => "spawn" in p && p.spawn === "player",
    );
    const playerLocation = playerSpawnPOI
        ? [playerSpawnPOI.geohash]
        : [geohash];

    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocation,
        player.locI,
    );

    // Change player location to world
    player.loc = playerLocation;
    player.locT = locationType as GeohashLocation;
    player.locI = locationInstance;

    // Save player
    player = (await saveEntity(player)) as PlayerEntity;

    // Inform all players of self location change
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(player, { stats: true })],
        { publishTo: nearbyPlayerIds },
    );

    return { player, pois };
}
