import {
    calculatePathDuration,
    entityInRange,
    geohashesNearby,
    getEntityId,
    minifiedEntity,
} from "$lib/crossover/utils";
import { actions } from "$lib/crossover/world/actions";
import {
    compendium,
    type EquipmentSlot,
} from "$lib/crossover/world/compendium";
import { playerStats } from "$lib/crossover/world/player";
import type { Direction } from "$lib/crossover/world/types";
import { cloneDeep } from "lodash-es";
import { setEntityBusy } from ".";
import { performAbility } from "./abilities";
import { spawnItem } from "./dungeonMaster";
import {
    fetchEntity,
    getNearbyEntities,
    getNearbyPlayerIds,
    inventoryQuerySet,
    itemRepository,
    playerRepository,
    playersInGeohashQuerySet,
    saveEntity,
} from "./redis";
import {
    type GameEntity,
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "./redis/entities";
import {
    canConfigureItem,
    canUseItem,
    isDirectionTraversable,
    itemVariableValue,
    parseItemVariables,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
} from "./utils";

export {
    configureItem,
    createItem,
    dropItem,
    equipItem,
    LOOK_PAGE_SIZE,
    moveEntity,
    movePlayer,
    performInventory,
    performLook,
    rest,
    say,
    setEntityBusy,
    takeItem,
    unequipItem,
    useItem,
};

const LOOK_PAGE_SIZE = 20;

async function say(player: PlayerEntity, message: string, now?: number) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.say.action,
        now: now,
    })) as PlayerEntity;

    // Get logged in players in geohash
    const players = await playersInGeohashQuerySet(
        geohashesNearby(player.loc[0].slice(0, -1), true), // use p7 square for `say` radius
    ).return.allIds({ pageSize: LOOK_PAGE_SIZE }); // limit players using page size

    // Send message to all players in the geohash (non blocking)
    for (const publicKey of players) {
        publishFeedEvent(publicKey, {
            type: "message",
            message: "${name} says ${message}",
            variables: {
                cmd: "say",
                player: player.player,
                name: player.name,
                message: message,
            },
        });
    }
}

async function moveEntity(
    entity: PlayerEntity | MonsterEntity,
    path: Direction[],
    now?: number,
): Promise<PlayerEntity> {
    // Get path duration
    now = now ?? Date.now();
    const duration = calculatePathDuration(path);
    const [entityId, entityType] = getEntityId(entity);

    // Check if player is busy
    entity = await setEntityBusy({
        entity: entity,
        action: actions.move.action,
        duration, // use the duration of the full path
        now,
    });

    // Check if the full path is traversable
    let loc = cloneDeep(entity.loc);
    for (const direction of path) {
        const [isTraversable, location] = await isDirectionTraversable(
            loc,
            direction,
        );
        if (!isTraversable) {
            const error = `Path is not traversable`;
            if (entityType === "player") {
                publishFeedEvent(entityId, {
                    type: "error",
                    message: error,
                });
            }
            throw new Error(error);
        } else {
            loc = location;
        }
    }

    // Check if player moves to a new p6
    const p6Changed = entity.loc[0].slice(0, -2) !== loc[0].slice(0, -2);

    // Update location and path
    entity.pth = path;
    entity.pthst = entity.loc[0]; // origin is always the first loc
    entity.pthdur = duration;
    entity.pthclk = now;
    entity.loc = loc; // update loc immediately to final location (client and server to use `pthclk` to determine exact location)
    entity = (await saveEntity(entity)) as PlayerEntity;

    // Inform all players nearby of location change
    const nearbyPlayerIds = await getNearbyPlayerIds(entity.loc[0]);
    publishAffectedEntitiesToPlayers(
        [minifiedEntity(entity, { location: true, now })],
        {
            publishTo: nearbyPlayerIds,
        },
    );

    // Request nearby entities if p6Changed
    if (p6Changed && entityType === "player") {
        const { players, monsters, items } = await getNearbyEntities(
            entity.loc[0],
            LOOK_PAGE_SIZE,
        );
        publishAffectedEntitiesToPlayers(
            [
                ...monsters.map((e) => minifiedEntity(e, { location: true })),
                ...players
                    .filter((p) => p.player !== entityId)
                    .map((e) => minifiedEntity(e, { location: true })), // exclude self (already received above)
                ...items.map((e) => minifiedEntity(e, { location: true })),
            ],
            { publishTo: [entityId] },
        );
    }

    return entity;
}

async function movePlayer(
    player: PlayerEntity,
    path: Direction[],
    now?: number,
): Promise<PlayerEntity> {
    // Get path duration
    now = now ?? Date.now();
    const duration = calculatePathDuration(path);

    // Check if player is busy
    const entity = await setEntityBusy({
        entity: player,
        action: actions.move.action,
        duration, // use the duration of the full path
        now,
    });

    // Check if the full path is traversable
    let loc = cloneDeep(player.loc);
    for (const direction of path) {
        const [isTraversable, location] = await isDirectionTraversable(
            loc,
            direction,
        );
        if (!isTraversable) {
            const error = `Path is not traversable`;
            publishFeedEvent(player.player, {
                type: "error",
                message: error,
            });
            throw new Error(error);
        } else {
            loc = location;
        }
    }

    // Check if player moves to a new p6
    const p6Changed = player.loc[0].slice(0, -2) !== loc[0].slice(0, -2);

    // Update player location and path
    player = entity as PlayerEntity;
    player.pth = path;
    player.pthst = player.loc[0]; // origin is always the first loc
    player.pthdur = duration;
    player.pthclk = now;
    player.loc = loc; // update loc immediately to final location (client and server to use `pthclk` to determine exact location)
    player = (await saveEntity(player)) as PlayerEntity;

    // Inform all players nearby of location change
    const nearbyPlayerIds = await getNearbyPlayerIds(player.loc[0]);
    publishAffectedEntitiesToPlayers(
        [minifiedEntity(player, { location: true, now })],
        {
            publishTo: nearbyPlayerIds,
        },
    );

    // Request nearby entities if p6Changed
    if (p6Changed) {
        const { players, monsters, items } = await getNearbyEntities(
            player.loc[0],
            LOOK_PAGE_SIZE,
        );
        publishAffectedEntitiesToPlayers(
            [
                ...monsters.map((e) => minifiedEntity(e, { location: true })),
                ...players
                    .filter((p) => p.player !== player.player)
                    .map((e) => minifiedEntity(e, { location: true })), // exclude self (already received above)
                ...items.map((e) => minifiedEntity(e, { location: true })),
            ],
            { publishTo: [player.player] },
        );
    }

    return player;
}

async function performLook(
    player: PlayerEntity,
    options?: { inventory?: boolean },
): Promise<GameEntity[]> {
    const { monsters, players, items } = await getNearbyEntities(
        player.loc[0],
        LOOK_PAGE_SIZE,
    );

    const inventoryItems = options?.inventory
        ? ((await inventoryQuerySet(
              player.player,
          ).return.all()) as ItemEntity[])
        : [];

    const entities = [
        player,
        ...monsters.map((e) => minifiedEntity(e, { location: true })),
        ...players.map((e) => minifiedEntity(e, { location: true })),
        ...items.map((e) => minifiedEntity(e, { location: true })),
        ...inventoryItems,
    ];

    publishAffectedEntitiesToPlayers(entities, {
        publishTo: [player.player],
        op: "replace",
    });

    return entities;
}

async function performInventory(player: PlayerEntity) {
    const inventoryItems = (await inventoryQuerySet(
        player.player,
    ).return.all()) as ItemEntity[];

    publishAffectedEntitiesToPlayers(inventoryItems, {
        publishTo: [player.player],
    });
}

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
    const nearbyPlayerIds = await getNearbyPlayerIds(self.loc[0]);

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
    const nearbyPlayerIds = await getNearbyPlayerIds(player.loc[0]);
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
    const nearbyPlayerIds = await getNearbyPlayerIds(player.loc[0]);
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
    const nearbyPlayerIds = await getNearbyPlayerIds(player.loc[0]);
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

    // Drop item
    itemEntity.loc = player.loc;
    itemEntity.locT = "geohash";
    itemEntity = (await itemRepository.save(
        itemEntity.item,
        itemEntity,
    )) as ItemEntity;

    // Inform all players nearby of item creation
    const nearbyPlayerIds = await getNearbyPlayerIds(player.loc[0]);
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
        const item = await spawnItem({
            geohash,
            prop,
            variables,
            owner: player.player, // owner is player
            configOwner: player.player,
        });

        // Inform all players nearby of item creation
        const nearbyPlayerIds = await getNearbyPlayerIds(player.loc[0]);
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

async function rest(player: PlayerEntity, now?: number) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.rest.action,
        now: now,
    })) as PlayerEntity;

    // Rest player
    player.hp = playerStats({ level: player.lvl }).hp;
    player.mp = playerStats({ level: player.lvl }).mp;
    player.st = playerStats({ level: player.lvl }).st;

    // Save player
    player = (await playerRepository.save(
        player.player,
        player,
    )) as PlayerEntity;

    // Publish update event
    publishAffectedEntitiesToPlayers([player], {
        publishTo: [player.player],
    });
}
