import {
    calculatePathDuration,
    entityInRange,
    geohashesNearby,
} from "$lib/crossover/utils";
import { actions } from "$lib/crossover/world/actions";
import {
    compendium,
    type EquipmentSlot,
} from "$lib/crossover/world/compendium";
import { playerStats } from "$lib/crossover/world/player";
import type { Direction } from "$lib/crossover/world/types";
import lodash from "lodash";
import { setEntityBusy } from ".";
import { performAbility } from "./abilities";
import { spawnItem } from "./dungeonMaster";
import {
    fetchEntity,
    getNearbyEntities,
    inventoryQuerySet,
    itemRepository,
    playerRepository,
    playersInGeohashQuerySet,
    saveEntity,
} from "./redis";
import {
    type ItemEntity,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
} from "./redis/entities";
import {
    canConfigureItem,
    canUseItem,
    getPlayerState,
    getUserMetadata,
    isDirectionTraversable,
    itemVariableValue,
    parseItemVariables,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
    setPlayerState,
} from "./utils";

const { cloneDeep } = lodash;

export {
    configureItem,
    createItem,
    dropItem,
    equipItem,
    getPlayerState,
    getUserMetadata,
    LOOK_PAGE_SIZE,
    movePlayer,
    performInventory,
    performLook,
    rest,
    say,
    setEntityBusy,
    setPlayerState,
    takeItem,
    unequipItem,
    useItem,
};

const LOOK_PAGE_SIZE = 20;

async function say(player: PlayerEntity, message: string, now?: number) {
    // Check if player is busy
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
            message: "${origin} says ${message}",
            variables: {
                cmd: "say",
                origin: player.player,
                message: message,
            },
        });
    }
}

async function movePlayer(
    player: PlayerEntity,
    path: Direction[],
    now?: number,
) {
    // Get path duration
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
            publishFeedEvent(player.player, {
                type: "error",
                message: `Path is not traversable`,
            });
            return;
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
    player.pthclk = Date.now();
    player.loc = loc; // update loc immediately to final location (client and server to use `pthclk` to determine exact location)
    player = (await saveEntity(player)) as PlayerEntity;

    // Return nearby entities if plot changed
    if (p6Changed) {
        const { monsters, players, items } = await getNearbyEntities(
            player.loc[0],
            LOOK_PAGE_SIZE,
        );
        publishAffectedEntitiesToPlayers(
            [player, ...monsters, ...players, ...items],
            { publishTo: player.player },
        );
    } else {
        // Just update player's location
        publishAffectedEntitiesToPlayers([player], {
            publishTo: player.player,
        });
    }

    // TODO: update players in vincinity

    // for (const direction of path) {
    //     // Check if direction is traversable
    //     const [isTraversable, location] = await isDirectionTraversable(
    //         player.loc,
    //         direction,
    //     );
    //     if (!isTraversable) {
    //         publishFeedEvent(player.player, {
    //             type: "error",
    //             message: `Cannot move ${direction}`,
    //         });
    //         break;
    //     }

    //     // Publish action
    //     publishActionEvent(player.player, {
    //         action: actions.move.action,
    //         source: player.player,
    //     });

    //     // Sleep for the duration of the effect
    //     await sleep(actions.move.ticks * MS_PER_TICK);

    //     // Update player location
    //     player = entity as PlayerEntity;
    //     player.loc = location;
    //     player = (await saveEntity(player)) as PlayerEntity;

    //     // Check if player moves to a different plot
    //     const plotDidChange =
    //         player.loc[0].slice(0, -1) !== location[0].slice(0, -1);

    //     // Return nearby entities if plot changed
    //     if (plotDidChange) {
    //         const { monsters, players, items } = await getNearbyEntities(
    //             player.loc[0],
    //             LOOK_PAGE_SIZE,
    //         );
    //         publishAffectedEntitiesToPlayers(
    //             [player, ...monsters, ...players, ...items],
    //             { publishTo: player.player },
    //         );
    //     }

    //     // Just update player (TODO: update players in vincinity)
    //     else {
    //         publishAffectedEntitiesToPlayers([player], {
    //             publishTo: player.player,
    //         });
    //     }
    // }
}

async function performLook(
    player: PlayerEntity,
    options?: { inventory?: boolean },
) {
    const { monsters, players, items } = await getNearbyEntities(
        player.loc[0],
        LOOK_PAGE_SIZE,
    );

    const inventoryItems = options?.inventory
        ? ((await inventoryQuerySet(
              player.player,
          ).return.all()) as ItemEntity[])
        : [];

    publishAffectedEntitiesToPlayers(
        [player, ...monsters, ...players, ...items, ...inventoryItems],
        { publishTo: player.player, op: "replace" },
    );
}

async function performInventory(player: PlayerEntity) {
    const inventoryItems = (await inventoryQuerySet(
        player.player,
    ).return.all()) as ItemEntity[];

    publishAffectedEntitiesToPlayers(inventoryItems, {
        publishTo: player.player,
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
}: {
    item: string;
    utility: string;
    self: PlayerEntity | MonsterEntity; // sell can only be `player` or `monster`
    target?: string; // target can be an `item`
}) {
    const selfBefore = { ...self }; // save self before substitution

    // Get item
    let itemEntity = (await fetchEntity(item)) as ItemEntity;
    if (itemEntity == null) {
        if (self.player) {
            publishFeedEvent((self as PlayerEntity).player, {
                type: "error",
                message: `Item ${item} not found`,
            });
        }
        return;
    }

    // Get target
    let targetEntity: PlayerEntity | MonsterEntity | ItemEntity | undefined =
        undefined;
    if (target) {
        const targetEntity = (await fetchEntity(target)) || undefined;
        if (targetEntity == null) {
            publishFeedEvent((self as PlayerEntity).player, {
                type: "error",
                message: `Target ${target} not found`,
            });
            return;
        }
    }

    // Check if can use item
    const { canUse, message } = canUseItem(self, itemEntity, utility);
    if (!canUse && self.player) {
        publishFeedEvent((self as PlayerEntity).player, {
            type: "error",
            message,
        });
        return;
    }

    const prop = compendium[itemEntity.prop];
    const propUtility = prop.utilities![utility];
    const propAbility = propUtility.ability;

    // Set item start state
    itemEntity.state = propUtility.state.start;
    itemEntity = (await itemRepository.save(
        itemEntity.item,
        itemEntity,
    )) as ItemEntity;

    // Publish item state to player
    // TODO: what about other people in the vincinity?
    if (self.player != null) {
        publishAffectedEntitiesToPlayers([self, itemEntity]); // non blocking
    }

    // Overwrite target if specified in item variables
    if (prop.variables.target) {
        targetEntity = (await itemVariableValue(itemEntity, "target")) as
            | PlayerEntity
            | MonsterEntity
            | ItemEntity;
    }

    // Overwrite self if specified in item variables (can only be `player` or `monster`)
    if (prop.variables.self) {
        self = (await itemVariableValue(itemEntity, "self")) as
            | PlayerEntity
            | MonsterEntity;
    }

    // Perform ability (ignore cost when using items)
    if (propAbility && target) {
        await performAbility({
            self,
            target,
            ability: propAbility,
            ignoreCost: true, // ignore cost when using items
        });
    }

    // Set item end state, consume charges and durability
    itemEntity.state = propUtility.state.end;
    itemEntity.chg -= propUtility.cost.charges;
    itemEntity.dur -= propUtility.cost.durability;
    itemEntity = (await itemRepository.save(
        itemEntity.item,
        itemEntity,
    )) as ItemEntity;

    // Publish item state to user (use selfBefore as it might have changed after substitution)
    // TODO: what about other people in the vincinity?
    if (selfBefore.player != null) {
        publishAffectedEntitiesToPlayers([itemEntity], {
            publishTo: (selfBefore as Player).player,
        }); // non blocking
    }
}

async function equipItem(
    player: PlayerEntity,
    item: string,
    slot: EquipmentSlot,
    now?: number,
) {
    player = (await setEntityBusy({
        entity: player,
        action: actions.equip.action,
        now: now,
    })) as PlayerEntity;

    let itemToEquip = (await fetchEntity(item)) as ItemEntity;

    if (itemToEquip == null) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `Item ${item} not found`,
        });
        return;
    }

    // Check if item is in player inventory (can be inventory or equipment slot)
    if (itemToEquip.loc[0] !== player.player) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not in inventory`,
        });
        return;
    }

    // Check equipment slot
    const slots = compendium[itemToEquip.prop].equipmentSlot;
    if (!slots) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not equippable`,
        });
        return;
    }
    if (!slots.includes(slot)) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `${item} cannot be equipped in ${slot}`,
        });
        return;
    }

    // Unequip existing item in slot
    const exitingItemsInSlot = (await inventoryQuerySet(player.player)
        .and("locT")
        .equal(slot)
        .return.all()) as ItemEntity[];
    for (const itemEntity of exitingItemsInSlot) {
        itemEntity.loc = [player.player];
        itemEntity.locT = "inv";
        await itemRepository.save(itemEntity.item, itemEntity);
    }

    // Equip item in slot
    itemToEquip.loc = [player.player];
    itemToEquip.locT = slot;
    itemToEquip = (await itemRepository.save(
        itemToEquip.item,
        itemToEquip,
    )) as ItemEntity;

    // Perform inventory
    performInventory(player);
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

    // Perform inventory
    performInventory(player);
}

async function takeItem(player: PlayerEntity, item: string, now?: number) {
    // Check if player is busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.take.action,
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

    // Check item owner is player or public
    if (itemEntity.own !== player.player && itemEntity.own) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is owned by someone else`,
        });
        return;
    }

    // Check if in range
    if (!entityInRange(player, itemEntity, actions.take.range)[0]) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `${item} is not in range`,
        });
        return;
    }

    // Check if item is takeable
    if (compendium[itemEntity.prop].weight < 0) {
        publishFeedEvent(player.player, {
            type: "error",
            message: `${item} cannot be taken`,
        });
        return;
    }

    // Take item
    itemEntity.loc = [player.player];
    itemEntity.locT = "inv";
    itemEntity = (await itemRepository.save(
        itemEntity.item,
        itemEntity,
    )) as ItemEntity;

    // Perform look
    performLook(player, { inventory: true });
}

async function dropItem(player: PlayerEntity, item: string, now?: number) {
    // Check if player is busy
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

    // Perform look
    performLook(player, { inventory: true });
}

async function createItem(
    player: PlayerEntity,
    geohash: string,
    prop: string,
    variables?: Record<string, string | number | boolean>,
    now?: number,
) {
    // Check if player is busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.create.action,
        now: now,
    })) as PlayerEntity;

    try {
        // Create item
        await spawnItem({
            geohash,
            prop,
            variables,
            owner: player.player, // owner is player
            configOwner: player.player,
        });

        // Perform look
        performLook(player, { inventory: true });
    } catch (error: any) {
        publishFeedEvent(player.player, {
            type: "error",
            message: error.message,
        });
        return;
    }
}

async function configureItem(
    player: PlayerEntity,
    item: string,
    variables: Record<string, string | number | boolean>,
    now?: number,
): Promise<ItemEntity> {
    // Check if player is busy
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

    // Perform look
    performLook(player, { inventory: true });

    return itemEntity;
}

async function rest(player: PlayerEntity, now?: number) {
    // Check if player is busy
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
        publishTo: player.player,
    });
}
