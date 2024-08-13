import Root from "./Game.svelte";

import {
    getDirectionsToPosition,
    type Position,
} from "$lib/components/crossover/Game/utils";
import { addMessageFeed } from "$lib/components/crossover/GameWindow";
import {
    crossoverCmdConfigureItem,
    crossoverCmdCreateItem,
    crossoverCmdDrop,
    crossoverCmdEquip,
    crossoverCmdLook,
    crossoverCmdMove,
    crossoverCmdPerformAbility,
    crossoverCmdRest,
    crossoverCmdSay,
    crossoverCmdTake,
    crossoverCmdUnequip,
    crossoverCmdUseItem,
    crossoverPlayerInventory,
    crossoverWorldWorlds,
} from "$lib/crossover/client";
import type { GameCommand, GameCommandVariables } from "$lib/crossover/ir";
import {
    entityInRange,
    geohashToColRow,
    getEntityId,
} from "$lib/crossover/utils";
import type { Ability } from "$lib/crossover/world/abilities";
import { actions, type Action } from "$lib/crossover/world/actions";
import {
    compendium,
    EquipmentSlots,
    type EquipmentSlot,
    type Utility,
} from "$lib/crossover/world/compendium";
import { playerAttributes } from "$lib/crossover/world/player";
import { MS_PER_TICK, SERVER_LATENCY } from "$lib/crossover/world/settings";
import { Directions, type Direction } from "$lib/crossover/world/types";
import { worldSeed } from "$lib/crossover/world/world";
import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { AsyncLock, sleep } from "$lib/utils";
import type { HTTPHeaders } from "@trpc/client";
import { groupBy } from "lodash-es";
import { Container, type Application } from "pixi.js";
import { get, type Writable } from "svelte/store";
import {
    equipmentRecord,
    itemRecord,
    monsterRecord,
    player,
    playerEquippedItems,
    playerInventoryItems,
    playerRecord,
    worldRecord,
} from "../../../../store";
import {
    cullEntityContainerById,
    entityContainers,
    entitySigils,
    upsertEntityContainer,
    upsertEntitySigil,
} from "./entities";
import { AvatarEntityContainer } from "./entities/AvatarEntityContainer";

export { executeGameCommand, updateEntities, updateWorlds, type GameLogic };

export default Root;

interface GameLogic {
    app: Application;
    stage: Container;
    handlePlayerPositionUpdate: (position: Position) => Promise<void>;
    handleTrackPlayer: (params: {
        position: Position;
        duration?: number;
    }) => Promise<void>;
}

/**
 * Call this to update wordRecord when player moves to a new town
 *
 * @param geohash - geohash of the player
 * @returns
 */
async function updateWorlds(geohash: string) {
    const t = geohash.slice(0, worldSeed.spatial.town.precision);
    // Already have world at town
    if (get(worldRecord)[t] != null) {
        return;
    }
    // Get world at town
    const { town, worlds } = await crossoverWorldWorlds(geohash);
    worldRecord.update((wr) => {
        if (wr[town] == null) {
            wr[town] = {}; // no world in town ({} is valid)
        }
        for (const w of worlds) {
            wr[town][w.world] = w;
        }
        return wr;
    });
}

/**
 * Use this to perform UI effects when an entity changes
 *
 * @param oldEntity - Old entity before change
 * @param newEntity - New entity after change
 */
function displayEntityEffects<T extends Player | Monster | Item>(
    oldEntity: T | null,
    newEntity: T,
    game: GameLogic,
) {
    // If just created don't display effects
    if (oldEntity == null) return;

    // Monster
    if ("monster" in oldEntity) {
        const deltaHp = oldEntity.hp - (newEntity as Monster).hp;
        if (deltaHp > 0) {
            addMessageFeed({
                message: `${oldEntity.monster} lost ${deltaHp} HP`,
                name: "",
                messageFeedType: "message",
            });
        }
    }
    // Player
    else if ("player" in oldEntity) {
        const deltaHp = oldEntity.hp - (newEntity as Player).hp;
        if (deltaHp > 0) {
            addMessageFeed({
                message: `${oldEntity.player} lost ${deltaHp} HP`,
                name: "",
                messageFeedType: "message",
            });
        }
    }
    // Item
    else if ("item" in oldEntity) {
    }
}

/**
 * Upsert entity containers for entities with lotT=geohash
 *
 * @param oldEntity
 * @param newEntity
 * @param game
 */
const updateEntityContainerLock = new AsyncLock();
async function updateEntityContainer<T extends Player | Monster | Item>(
    oldEntity: T | null,
    newEntity: T,
    game: GameLogic,
) {
    updateEntityContainerLock.withLock(async () => {
        if (newEntity.locT === "geohash") {
            const [created, ec] = await upsertEntityContainer(
                newEntity,
                game.stage,
            );

            if (created) {
                // Load initial inventory
                if (ec instanceof AvatarEntityContainer) {
                    const entityEquipment = get(equipmentRecord)[ec.entityId];
                    if (entityEquipment) {
                        ec.loadInventory(Object.values(entityEquipment));
                    }
                }

                // Player (self)
                if (ec.entityId === get(player)?.player) {
                    const self = ec.entity as Player;
                    const avatar = (ec as AvatarEntityContainer).avatar;

                    // Attach game events
                    ec.on("positionUpdate", game.handlePlayerPositionUpdate);
                    ec.on("trackEntity", game.handleTrackPlayer);

                    // Initial event
                    if (ec.isoPosition != null) {
                        game.handlePlayerPositionUpdate(ec.isoPosition);
                        game.handleTrackPlayer({ position: ec.isoPosition });
                    }

                    // Create sigil (at bottom left)
                    if (avatar) {
                        const sigil = await upsertEntitySigil(
                            ec,
                            game.app.stage,
                            playerAttributes(self),
                        );
                        const bounds = sigil.getBounds();
                        const padding = 10;
                        sigil.position.set(
                            padding + bounds.width / 2,
                            game.app.screen.height -
                                padding -
                                bounds.height / 2,
                        );
                    }
                }
            }

            // Update sigils (only upsert if already created as we dont want sigils for every entity)
            if (entitySigils[ec.entityId]) {
                entitySigils[ec.entityId].updateStats(
                    newEntity as Player | Monster,
                );
            }
        } else {
            // Cull ec if not in environment
            cullEntityContainerById(getEntityId(newEntity)[0]);
        }
    });
}

/**
 * Use this to update the player (self) and perform additional logic
 *
 * @param oldEntity - Old PlayerEntity before change
 * @param newEntity - New PlayerEntity after change
 */
async function updatePlayer(
    oldEntity: Player | null,
    newEntity: Player,
    game: GameLogic,
) {
    if (newEntity.player === get(player)?.player) {
        // Set player (self)
        player.set(newEntity);

        // Update worlds if location changed
        if (oldEntity == null || oldEntity.loc[0] !== newEntity.loc[0]) {
            await updateWorlds(newEntity.loc[0]);
        }
    }
}

/**
 * Use this to update the player (self) and perform additional logic
 *
 * @param oldItem - Old Entity before change
 * @param newItem - New Entity after change
 */
async function updateEquipment(
    oldItem: Item | null,
    newItem: Item,
    game: GameLogic,
) {
    if (newItem.locT !== "geohash") {
        equipmentRecord.update((er) => {
            const entityId = newItem.loc[0];
            if (er[entityId]) {
                er[entityId][newItem.item] = newItem;
            } else {
                er[entityId] = {
                    [newItem.item]: newItem,
                };
            }
            return er;
        });
    }
}

function loadInventory(record: Record<string, Item>) {
    const playerId = get(player)?.player;
    for (const [entityId, items] of Object.entries(
        groupBy(
            Object.values(record).filter((i) => i.locT !== "geohash"),
            (i) => i.loc[0],
        ),
    )) {
        const ec = entityContainers[entityId];
        if (ec && ec instanceof AvatarEntityContainer) {
            ec.loadInventory(items);
        }

        // Set player (self) equipment & inventory
        if (playerId === entityId) {
            playerEquippedItems.set(items.filter((i) => i.locT !== "inv"));
            playerInventoryItems.set(items.filter((i) => i.locT === "inv"));
        }
    }
}

function updateEntities(
    {
        players,
        items,
        monsters,
        op,
    }: {
        players?: Player[];
        items?: Item[];
        monsters?: Monster[];
        op?: "upsert" | "replace";
    },
    game: GameLogic,
) {
    op = op ?? "upsert";

    // Update itemRecord
    if (items?.length) {
        updateRecord<Item>(itemRecord, items, "item", op, game, {
            handleChanged: [
                updateEquipment,
                updateEntityContainer,
                displayEntityEffects,
            ],
            onComplete: loadInventory,
        });
    }

    // Update monsterRecord
    if (monsters?.length) {
        updateRecord<Monster>(monsterRecord, monsters, "monster", op, game, {
            handleChanged: [updateEntityContainer, displayEntityEffects],
        });
    }

    // Update playerRecord
    if (players?.length) {
        updateRecord<Player>(playerRecord, players, "player", op, game, {
            handleChanged: [
                updatePlayer, // Update player (self)
                updateEntityContainer,
                displayEntityEffects,
            ],
        });
    }
}

function updateRecord<T extends { [key: string]: any }>(
    record: Writable<Record<string, T>>,
    entities: T[],
    idKey: keyof T & string,
    op: "upsert" | "replace",
    game: GameLogic,
    callbacks?: {
        handleChanged?: ((
            oldEntity: T | null,
            newEntity: T,
            game: GameLogic,
        ) => void)[];
        onComplete?: (record: Record<string, T>) => void;
    },
) {
    record.update((r) => {
        // Replace entire record
        const newRecord = op === "replace" ? {} : r;
        for (const entity of entities) {
            const entityId = entity[idKey];
            // Update entity
            if (newRecord[entityId]) {
                const updatedEnity = { ...newRecord[entityId], ...entity };
                if (callbacks?.handleChanged) {
                    for (const f of callbacks?.handleChanged) {
                        f(newRecord[entityId], updatedEnity, game);
                    }
                }
                newRecord[entityId] = updatedEnity;
            }
            // Create entity
            else {
                if (callbacks?.handleChanged) {
                    for (const f of callbacks?.handleChanged) {
                        f(null, entity, game);
                    }
                }
                newRecord[entityId] = entity;
            }
        }
        return newRecord;
    });
    if (callbacks?.onComplete) {
        callbacks.onComplete(get(record));
    }
}

async function moveInRangeOfTarget({
    range,
    target,
    retries,
}: {
    range: number;
    target: Player | Monster | Item;
    retries?: number;
}) {
    retries ??= 1;

    let playerEntity = get(player);
    if (playerEntity == null) {
        throw new Error("Player is not defined");
    }

    if (entityInRange(playerEntity, target, range)[0]) {
        return;
    }

    // Move in range of target
    const targetGeohash = target.loc[0]; // TODO: consider entities with loc more than 1 cell
    const sourceGeohash = playerEntity.loc[0];
    const [targetCol, targetRow] = geohashToColRow(targetGeohash);
    const [sourceCol, sourceRow] = geohashToColRow(sourceGeohash);
    const path = getDirectionsToPosition(
        {
            row: sourceRow,
            col: sourceCol,
        },
        {
            row: targetRow,
            col: targetCol,
        },
        range,
    );
    await crossoverCmdMove({ path });

    // Wait for player to move the path
    await sleep(
        SERVER_LATENCY + path.length * actions.move.ticks * MS_PER_TICK,
    );

    // Retry if is still not in range (target might have moved)
    playerEntity = get(player);
    if (
        retries > 0 &&
        playerEntity != null &&
        !entityInRange(playerEntity, target, range)[0]
    ) {
        await moveInRangeOfTarget({ range, target, retries: retries - 1 });
    }
}

async function executeGameCommand(
    command: GameCommand,
    headers: HTTPHeaders = {},
): Promise<void> {
    const [action, { self, target, item }, variables] = command;

    try {
        // Use Item
        if (item != null) {
            return await crossoverCmdUseItem(
                {
                    target:
                        (target as Player)?.player ||
                        (target as Monster)?.monster ||
                        (target as Item)?.item ||
                        undefined,
                    item: item.item,
                    utility: (action as Utility).utility,
                },
                headers,
            );
        }
        // Perform ability
        else if ("ability" in action) {
            const ability = action as Ability;

            // Move in range of target
            await moveInRangeOfTarget({
                range: ability.range,
                target: target as Player | Monster | Item,
            });
            // Perform ability
            return await crossoverCmdPerformAbility(
                {
                    target:
                        (target as Player)?.player ||
                        (target as Monster)?.monster ||
                        (target as Item)?.item,
                    ability: ability.ability,
                },
                headers,
            );
        }
        // Action (variables are required)
        else if ("action" in action) {
            return await performAction({
                self,
                action,
                target,
                variables,
            });
        }
    } catch (error: any) {
        addMessageFeed({
            message: error.message,
            name: "Error",
            messageFeedType: "error",
        });
    }
}

async function performAction(
    {
        self,
        action,
        target,
        variables,
    }: {
        action: Action;
        self: Player | Monster;
        target?: Player | Monster | Item;
        variables?: GameCommandVariables;
    },
    headers: HTTPHeaders = {},
): Promise<void> {
    // look
    if (action.action === "look") {
        return await crossoverCmdLook(
            { target: target ? getEntityId(target)[0] : undefined },
            headers,
        );
    }
    // say
    else if (action.action === "say" && variables != null) {
        return await crossoverCmdSay(
            { message: variables.queryIrrelevant },
            headers,
        );
    }
    // move
    else if (action.action === "move" && variables != null) {
        const direction = variables.queryIrrelevant as Direction;
        if (Directions.includes(direction)) {
            return await crossoverCmdMove({ path: [direction] }, headers);
        }
        throw new Error(`Invalid direction ${direction}`);
    }
    // take
    else if (action.action === "take") {
        return await crossoverCmdTake(
            { item: getEntityId(target as Item)[0] },
            headers,
        );
    }
    // drop
    else if (action.action === "drop") {
        return await crossoverCmdDrop(
            { item: getEntityId(target as Item)[0] },
            headers,
        );
    }
    // equip
    else if (action.action === "equip" && variables != null) {
        // Get equipment slot from query else from prop
        const item = target as Item;
        const slotFromQuery = variables.queryIrrelevant as EquipmentSlot;
        const slot = EquipmentSlots.includes(slotFromQuery)
            ? slotFromQuery
            : compendium[item.prop].equipmentSlot?.[0];
        if (slot) {
            return await crossoverCmdEquip(
                {
                    item: getEntityId(item)[0],
                    slot,
                },
                headers,
            );
        }
        throw new Error(`Invalid slot ${slot}`);
    }
    // unequip
    else if (action.action === "unequip") {
        return await crossoverCmdUnequip(
            { item: getEntityId(target as Item)[0] },
            headers,
        );
    }
    // create
    else if (action.action === "create" && variables != null) {
        const prop = variables.queryIrrelevant as string;
        const geohash = self.loc[0];
        if (Object.keys(compendium).includes(prop)) {
            return await crossoverCmdCreateItem(
                {
                    geohash,
                    prop: prop,
                },
                headers,
            );
        }
        throw new Error(`Invalid prop ${prop}`);
    }
    // configure
    else if (action.action === "configure" && variables != null) {
        const [key, val] = variables.queryIrrelevant.split(":");
        return await crossoverCmdConfigureItem(
            { item: getEntityId(target as Item)[0], variables: { [key]: val } },
            headers,
        );
    }
    // inventory
    else if (action.action === "inventory") {
        return await crossoverPlayerInventory(headers);
    }
    // rest
    else if (action.action === "rest") {
        return await crossoverCmdRest(headers);
    }

    throw new Error(`Unknown action ${action}`);
}
