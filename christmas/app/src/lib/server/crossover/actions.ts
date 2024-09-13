import {
    calculatePathDuration,
    entityInRange,
    geohashesNearby,
    getEntityId,
    minifiedEntity,
} from "$lib/crossover/utils";
import { actions } from "$lib/crossover/world/actions";
import { entityStats } from "$lib/crossover/world/entity";
import {
    MS_PER_TICK,
    TILE_HEIGHT,
    TILE_WIDTH,
} from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { skillLines } from "$lib/crossover/world/settings/skills";
import {
    learningDialoguesForSkill,
    skillLevelProgression,
    type SkillLines,
} from "$lib/crossover/world/skills";
import {
    geohashLocationTypes,
    type Currency,
    type Direction,
    type EquipmentSlot,
    type GeohashLocationType,
} from "$lib/crossover/world/types";
import type { WorldPOIs } from "$lib/crossover/world/world";
import {
    generatePin,
    sleep,
    substituteValues,
    substituteVariables,
} from "$lib/utils";
import { cloneDeep } from "lodash-es";
import { setEntityBusy } from ".";
import { performAbility } from "./abilities";
import { worldAssetMetadataCache, worldPOIsCache } from "./caches";
import { spawnItem, spawnWorld, spawnWorldPOIs } from "./dungeonMaster";
import { isEntityActualPlayer, npcRespondToAction } from "./npc";
import {
    createP2PTransaction,
    type CTA,
    type P2PLearnTransaction,
} from "./player";
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
    publishActionEvent,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
    savePlayerState,
} from "./utils";

export {
    canLearnSkillFrom,
    configureItem,
    createItem,
    createLearnCTA,
    dropItem,
    enterItem,
    equipItem,
    executeLearnCTA,
    learn,
    LOOK_PAGE_SIZE,
    moveEntity,
    performInventory,
    performLook,
    rest,
    say,
    setEntityBusy,
    takeItem,
    trade,
    unequipItem,
    useItem,
};

const LOOK_PAGE_SIZE = 20;

async function say(
    player: PlayerEntity,
    message: string,
    options?: {
        target?: string;
        now?: number;
        overwrite?: boolean;
    },
) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.say.action,
        now: options?.now,
    })) as PlayerEntity;

    // Say to specific player
    let players: string[] = [];
    if (options?.target) {
        const targetEntity = await fetchEntity(options.target);
        if (targetEntity && "player" in targetEntity) {
            // Say to npc
            if (targetEntity.npc) {
                npcRespondToAction({
                    entity: player,
                    target: targetEntity as PlayerEntity,
                    action: "say",
                });
            }
            // Say to human player (in range)
            else if (
                player.locI === targetEntity.locI &&
                player.locT === targetEntity.locT &&
                geohashesNearby(player.loc[0].slice(0, -1), true).find((g) =>
                    targetEntity.loc[0].startsWith(g),
                )
            ) {
                players = [options.target];
            }
        }
    }
    // Say to nearby player
    else {
        // Get logged in players in geohash
        players = await playersInGeohashQuerySet(
            geohashesNearby(player.loc[0].slice(0, -1), true), // use p7 square for `say` radius
            player.locT as GeohashLocationType,
            player.locI,
        ).return.allIds({ pageSize: LOOK_PAGE_SIZE }); // limit players using page size
    }

    // Send message to all players in the geohash (non blocking)
    for (const publicKey of players) {
        publishFeedEvent(publicKey, {
            type: "message",
            message: options?.overwrite
                ? "${message}"
                : "${name} says ${message}",
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
): Promise<PlayerEntity | MonsterEntity> {
    // Get path duration
    now = now ?? Date.now();
    const duration = calculatePathDuration(path);
    const [entityId, entityType] = getEntityId(entity);

    // Check if entity is busy
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
            entity.locT as GeohashLocationType,
            entity.locI,
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

    // Check if entity moves to a new p6
    const p6Changed = entity.loc[0].slice(0, -2) !== loc[0].slice(0, -2);

    // Update location and path
    entity.pth = path;
    entity.pthst = entity.loc[0]; // origin is always the first loc
    entity.pthdur = duration;
    entity.pthclk = now;
    entity.loc = loc; // update loc immediately to final location (client and server to use `pthclk` to determine exact location)
    entity = (await saveEntity(entity)) as PlayerEntity | MonsterEntity;

    // Inform all players nearby of location change
    const nearbyPlayerIds = await getNearbyPlayerIds(
        entity.loc[0],
        entity.locT as GeohashLocationType,
        entity.locI,
    );
    publishAffectedEntitiesToPlayers(
        [minifiedEntity(entity, { location: true, demographics: true })],
        {
            publishTo: nearbyPlayerIds,
        },
    );

    // Request nearby entities if p6Changed
    if (p6Changed && entityType === "player") {
        const { players, monsters, items } = await getNearbyEntities(
            entity.loc[0],
            entity.locT as GeohashLocationType,
            entity.locI,
            LOOK_PAGE_SIZE,
        );
        publishAffectedEntitiesToPlayers(
            [
                ...monsters.map((e) => minifiedEntity(e, { location: true })),
                ...players
                    .filter((p) => p.player !== entityId)
                    .map((e) =>
                        minifiedEntity(e, {
                            location: true,
                            demographics: true,
                        }),
                    ), // exclude self (already received above)
                ...items.map((e) => minifiedEntity(e, { location: true })),
            ],
            { publishTo: [entityId] },
        );
    }

    return entity;
}

async function performLook(
    player: PlayerEntity,
    options?: { inventory?: boolean },
): Promise<GameEntity[]> {
    const { monsters, players, items } = await getNearbyEntities(
        player.loc[0],
        player.locT as GeohashLocationType,
        player.locI,
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
        ...players.map((e) =>
            minifiedEntity(e, { location: true, demographics: true }),
        ),
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
        const item = await spawnItem({
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

async function executeLearnCTA(
    executor: PlayerEntity,
    writ: P2PLearnTransaction,
) {
    const { teacher, skill, player } = writ;

    // Check that the player executing the writ is the teacher
    if (executor.player !== teacher) {
        publishFeedEvent(executor.player, {
            type: "error",
            message: `You try to execute the writ, but it rejects you with a slight jolt.`,
        });
    }

    await learn(
        (await fetchEntity(player)) as PlayerEntity, // get the student from the writ
        teacher,
        skill,
    );
}

async function createLearnCTA(
    player: PlayerEntity,
    teacher: PlayerEntity,
    skill: SkillLines,
): Promise<CTA> {
    // Teacher is a human player - request a P2PLearnTransaction and terminate early
    if (isEntityActualPlayer(teacher)) {
        const expiresIn = 60;
        const pin = generatePin(4);
        const learnTx: P2PLearnTransaction = {
            action: "learn",
            message: `${player.name} requests to ${skill} from you. You have ${expiresIn} to *accept ${pin}*`,
            teacher: teacher.player,
            player: player.player,
            skill,
        };
        return {
            cta: "writ",
            name: "Writ of Learning",
            description: `This writ allows you to learn ${skill} from ${teacher.name}.`,
            token: await createP2PTransaction(learnTx, 60),
            pin,
        };
    }

    throw new Error("Teacher is not a player");
}

async function learn(
    player: PlayerEntity,
    teacher: string,
    skill: SkillLines,
): Promise<PlayerEntity> {
    const playerIsHuman = isEntityActualPlayer(player);
    const teacherEntity = (await fetchEntity(teacher)) as PlayerEntity;
    const [canLearn, cannotLearnMessage] = canLearnSkillFrom(
        player,
        teacherEntity,
        skill,
    );

    // Cannot learn - send `cannotLearnMessage` back to player
    if (!canLearn && playerIsHuman) {
        await say(teacherEntity, cannotLearnMessage, {
            target: player.player,
            overwrite: true,
        });
        return player;
    }

    // Get nearby players
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocationType,
        player.locI,
    );

    // Publish action event
    publishActionEvent(nearbyPlayerIds, {
        action: "learn",
        source: teacher,
        target: player.player,
    });

    // Consume learning resources and increment player skill
    let deduct = skillLevelProgression(player.skills[skill] ?? 1);
    for (const cur of skillLines[skill].currency) {
        if (deduct > 0) {
            player[cur] = Math.max(player[cur] - deduct, 0);
            deduct -= player[cur];
        }
    }
    if (player.skills[skill]) {
        player.skills[skill] += 1;
    } else {
        player.skills[skill] = 1;
    }

    // Save player
    player = (await saveEntity(player)) as PlayerEntity;
    await savePlayerState(player.player);

    // Publish to nearby players
    publishAffectedEntitiesToPlayers([player], {
        publishTo: nearbyPlayerIds,
        op: "upsert",
    });

    // Send learning dialogues
    if (playerIsHuman) {
        // Get skill learning dialogues
        const learningDialogues = learningDialoguesForSkill(
            skill,
            player.skills[skill] ?? 1,
        );
        // Start the lesson
        for (const msg of learningDialogues) {
            const message = substituteVariables(msg, {
                player,
                teacher: teacherEntity,
                skill: skillLines[skill],
            });
            await say(teacherEntity, message, {
                target: player.player,
                overwrite: true,
            });
            await sleep(
                (actions.learn.ticks * MS_PER_TICK) / learningDialogues.length,
            );
        }
    }

    return player;
}

function canLearnSkillFrom(
    player: PlayerEntity,
    teacher: PlayerEntity,
    skill: SkillLines,
): [boolean, string] {
    if (!teacher.player) {
        return [false, "You might as well try to learn from a rock."];
    }

    // Can only learn up to teacher's skill level - 1
    const playerSkillLevel = player.skills[skill] ?? 0;
    const currencies = skillLines[skill].currency;
    const playerCurrency = currencies.reduce((p, c) => p + player[c], 0);
    const requiredCurrency = skillLevelProgression(playerSkillLevel + 1);

    // Teacher not at skill level
    if (
        !teacher.skills[skill] ||
        teacher.skills[skill] - 1 < playerSkillLevel
    ) {
        return [
            false,
            `${teacher.name} furrows his brow. 'This skill lies beyond even my grasp. Seek out one more learned than I.'`,
        ];
    }
    // Player not enough learning resources
    else if (playerCurrency < requiredCurrency) {
        return [
            false,
            "Despite your best efforts, the skill eludes you, perhaps with more experience.",
        ];
    }

    return [true, ""];
}

interface Barter {
    items: ItemEntity[];
    currency: Record<Currency, number>;
}

function playerHasBarter(player: PlayerEntity, barter: Barter): boolean {
    // Check player as all barter items in inventory
    for (const item of barter.items) {
        if (item.locT !== "inv" || item.loc[0] !== player.player) {
            return false;
        }
    }
    // Check player has all barter currencies
    for (const [cur, amt] of Object.entries(barter.currency)) {
        if (player[cur as Currency] < amt) {
            return false;
        }
    }
    return true;
}

function canTradeWith(
    player: PlayerEntity,
    trader: PlayerEntity,
    offer: Barter,
    receive: Barter,
): [boolean, string] {
    // Check if trader is a player
    if (!trader.player) {
        return [false, "You might as well try to trade with a rock."];
    }

    // Check trader and player has required items/currencies
    if (!playerHasBarter(player, offer)) {
        return [
            false,
            "You do not have the items or currencies needed to barter.",
        ];
    }
    if (!playerHasBarter(trader, receive)) {
        return [
            false,
            `${trader.name} does not have the items or currencies needed to barter.`,
        ];
    }

    return [true, ""];
}

function barterDialogue(barter: Barter, from: PlayerEntity, to: PlayerEntity) {
    const itemsDescription = barter.items.join(", ");
    const currenciesDescription = Object.entries(barter.currency)
        .map((cur, amt) => `${amt}${cur}`)
        .join(", ");

    const barterDesc = [itemsDescription, currenciesDescription]
        .filter((s) => Boolean(s))
        .join(" and ");

    return `${from.name} hands you ${barterDesc}, 'Pleasure doing business with you, ${to.name}'`;
}

async function trade(
    player: PlayerEntity,
    trader: string,
    offer: Barter,
    receive: Barter,
) {
    const playerIsHuman = isEntityActualPlayer(player);
    const traderEntity = (await fetchEntity(trader)) as PlayerEntity;
    const traderIsHuman = isEntityActualPlayer(traderEntity);

    const [canTrade, cannotTradeMessage] = canTradeWith(
        player,
        traderEntity,
        offer,
        receive,
    );

    // Cannot trade - send `cannotLearnMessage` back to player
    if (!canTrade && playerIsHuman) {
        await say(traderEntity, cannotTradeMessage, {
            target: player.player,
            overwrite: true,
        });
    }

    // Get nearby players
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocationType,
        player.locI,
    );

    // Publish action event
    publishActionEvent(nearbyPlayerIds, {
        action: "trade",
        source: trader,
        target: player.player,
    });

    // Transfer offer from player to trader
    for (const item of offer.items) {
        item.locT = "inv";
        item.loc = traderEntity.loc;
        await saveEntity(item);
    }
    for (const [cur, amt] of Object.entries(offer.currency)) {
        player[cur as Currency] -= amt;
        traderEntity[cur as Currency] += amt;
        await saveEntity(player);
        await saveEntity(traderEntity);
    }

    // Transfer receive from trader to player
    for (const item of receive.items) {
        item.locT = "inv";
        item.loc = player.loc;
        await saveEntity(item);
    }
    for (const [cur, amt] of Object.entries(receive.currency)) {
        traderEntity[cur as Currency] -= amt;
        player[cur as Currency] += amt;
        await saveEntity(player);
        await saveEntity(traderEntity);
    }

    // Save player's state to MINIO
    await savePlayerState(player.player);
    await savePlayerState(traderEntity.player);

    // Publish to nearby players
    publishAffectedEntitiesToPlayers(
        [player, traderEntity, ...offer.items, ...receive.items],
        {
            publishTo: [player.player, trader],
            op: "upsert",
        },
    );

    // Send dialogues
    if (playerIsHuman) {
        say(traderEntity, barterDialogue(receive, traderEntity, player), {
            target: player.player,
            overwrite: true,
        });
    }
    if (traderIsHuman) {
        say(player, barterDialogue(offer, player, traderEntity), {
            target: trader,
            overwrite: true,
        });
    }
}

async function rest(player: PlayerEntity, now?: number) {
    // Set busy
    player = (await setEntityBusy({
        entity: player,
        action: actions.rest.action,
        now: now,
    })) as PlayerEntity;

    // Rest player
    const { hp, mp, st } = entityStats(player);
    player.hp = hp;
    player.mp = mp;
    player.st = st;

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
