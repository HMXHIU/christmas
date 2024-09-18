import {
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "$lib/crossover/types";
import {
    entityInRange,
    getEntityId,
    minifiedEntity,
} from "$lib/crossover/utils";
import { TILE_HEIGHT, TILE_WIDTH } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    geohashLocationTypes,
    type EquipmentSlot,
    type GeohashLocationType,
} from "$lib/crossover/world/types";
import type { WorldPOIs } from "$lib/crossover/world/world";
import { substituteValues } from "$lib/utils";
import { setEntityBusy } from "..";
import { performAbility } from "../abilities";
import { worldAssetMetadataCache, worldPOIsCache } from "../caches";
import {
    spawnItemAtGeohash,
    spawnWorld,
    spawnWorldPOIs,
} from "../dungeonMaster";
import {
    fetchEntity,
    getNearbyPlayerIds,
    inventoryQuerySet,
    itemRepository,
    saveEntity,
} from "../redis";
import {
    canConfigureItem,
    canUseItem,
    itemVariableValue,
    parseItemVariables,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
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
    self: PlayerEntity | MonsterEntity;
    target?: string; // target can be an `item`
    now?: number;
}): Promise<ItemEntity> {
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
        if (!canUse && self.player) {
            error = message;
        }
    }

    if (error) {
        if (self.player) {
            publishFeedEvent((self as PlayerEntity).player, {
                type: "error",
                message: error,
            });
        }
        throw new Error(error);
    }

    const prop = compendium[itemEntity.prop];
    const propUtility = prop.utilities[utility];
    const propAbility = propUtility.ability;
    const nearbyPlayerIds = await getNearbyPlayerIds(
        self.loc[0],
        self.locT as GeohashLocationType,
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
            publishAffectedEntitiesToPlayers([minifiedEntity(itemEntity)], {
                publishTo: nearbyPlayerIds,
            });
        }
    }
    // Perform ability (ignore cost when using items)
    if (propAbility) {
        // Overwrite target if specified in item variables
        if (prop.variables.target) {
            targetEntity = (await itemVariableValue(itemEntity, "target")) as
                | PlayerEntity
                | MonsterEntity
                | ItemEntity;
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
    publishAffectedEntitiesToPlayers(
        [minifiedEntity(itemEntity, { stats: true, location: true })],
        {
            publishTo: nearbyPlayerIds,
        },
    );

    return itemEntity;
}

async function equipItem(
    player: PlayerEntity,
    item: string,
    slot: EquipmentSlot,
    now?: number,
): Promise<ItemEntity> {
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
        publishFeedEvent(player.player, {
            type: "error",
            message: error,
        });
        throw new Error(error);
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
        player.locT as GeohashLocationType,
        player.locI,
    );
    publishAffectedEntitiesToPlayers(
        [itemToEquip, ...exitingItemsInSlot].map((e) =>
            minifiedEntity(e, { location: true }),
        ),
        {
            publishTo: nearbyPlayerIds,
        },
    );

    return itemToEquip;
}

async function unequipItem(player: PlayerEntity, item: string, now?: number) {
    let itemEntity = (await fetchEntity(item)) as ItemEntity;

    if (itemEntity == null) {
        publishFeedEvent(player.player, {
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
        publishFeedEvent(player.player, {
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
        player.locT as GeohashLocationType,
        player.locI,
    );
    publishAffectedEntitiesToPlayers(
        [minifiedEntity(itemEntity, { location: true })],
        {
            publishTo: nearbyPlayerIds,
        },
    );
}

async function takeItem(
    player: PlayerEntity,
    item: string,
    now?: number,
): Promise<ItemEntity> {
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
        publishFeedEvent(player.player, {
            type: "error",
            message: error,
        });
        throw new Error(error);
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
        player.locT as GeohashLocationType,
        player.locI,
    );
    publishAffectedEntitiesToPlayers(
        [minifiedEntity(itemEntity, { location: true, stats: true })],
        { publishTo: nearbyPlayerIds },
    );

    return itemEntity;
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
        publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        return;
    }

    if (itemEntity.loc[0] !== player.player) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not in inventory`,
        });
        return;
    }

    if (!geohashLocationTypes.has(player.locT)) {
        publishFeedEvent(player.player, {
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
        player.locT as GeohashLocationType,
        player.locI,
    );
    publishAffectedEntitiesToPlayers(
        [minifiedEntity(itemEntity, { location: true, stats: true })],
        { publishTo: nearbyPlayerIds },
    );
}

async function createItem(
    player: PlayerEntity,
    geohash: string,
    prop: string,
    variables?: Record<string, string | number | boolean>,
    now?: number,
): Promise<ItemEntity> {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.create.action,
        now: now,
    })) as PlayerEntity;

    try {
        // Create item
        const item = await spawnItemAtGeohash({
            geohash,
            locationType: player.locT as GeohashLocationType,
            locationInstance: player.locI,
            prop,
            variables,
            owner: player.player, // owner is player
            configOwner: player.player,
        });

        // Inform all players nearby of item creation
        const nearbyPlayerIds = await getNearbyPlayerIds(
            player.loc[0],
            player.locT as GeohashLocationType,
            player.locI,
        );
        publishAffectedEntitiesToPlayers(
            [minifiedEntity(item, { location: true, stats: true })],
            { publishTo: nearbyPlayerIds },
        );

        return item;
    } catch (error: any) {
        publishFeedEvent(player.player, {
            type: "error",
            message: error.message,
        });
        throw new Error(error.message);
    }
}

async function configureItem(
    player: PlayerEntity,
    item: string,
    variables: Record<string, string | number | boolean>,
    now?: number,
): Promise<ItemEntity> {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.configure.action,
        now: now,
    })) as PlayerEntity;

    // Get item
    let itemEntity = (await fetchEntity(item)) as ItemEntity;
    if (itemEntity == null) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        throw new Error(`Item ${item} not found`);
    }

    // Check in range
    if (!entityInRange(player, itemEntity, actions.configure.range)[0]) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not in range`,
        });
        throw new Error(`${item} is not in range`);
    }

    // Check if can configure item
    const { canConfigure, message } = canConfigureItem(player, itemEntity);
    if (!canConfigure) {
        publishFeedEvent(player.player, {
            type: "error",
            message,
        });
        throw new Error(message);
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
    publishAffectedEntitiesToPlayers([minifiedEntity(itemEntity)], {
        publishTo: [player.player],
    });

    return itemEntity;
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
        publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        throw new Error(`Item ${item} not found`);
    }

    // Check in range
    if (!entityInRange(player, itemEntity, actions.enter.range)[0]) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not in range`,
        });
        throw new Error(`${item} is not in range`);
    }

    // Check if can item can be entered
    const prop = compendium[itemEntity.prop];
    if (!prop.world) {
        const message = `${prop.defaultName} is not something you can enter`;
        publishFeedEvent(player.player, {
            type: "error",
            message,
        });
        throw new Error(message);
    }

    // Substitute world variables
    const { locationInstance, geohash, world, url, locationType } =
        substituteValues(prop.world as any, {
            ...itemEntity.vars,
            self: itemEntity,
        });

    // Spawn world (if not exists)
    let worldEntity = await spawnWorld({
        world, // specify the worldId manually
        geohash,
        locationType: locationType as GeohashLocationType,
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

    // Check for player spawn point (use item)
    const playerSpawnPOI = pois.find(
        (p) => "spawn" in p && p.spawn === "player",
    );
    const playerLocation = playerSpawnPOI
        ? [playerSpawnPOI.geohash]
        : [geohash];

    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocationType,
        player.locI,
    );

    // Change player location to world
    player.loc = playerLocation;
    player.locT = locationType as GeohashLocationType;
    player.locI = locationInstance;

    // Save player
    player = (await saveEntity(player)) as PlayerEntity;

    // Inform all players of self location change
    publishAffectedEntitiesToPlayers(
        [minifiedEntity(player, { location: true, stats: true })],
        { publishTo: nearbyPlayerIds },
    );

    return { player, pois };
}
