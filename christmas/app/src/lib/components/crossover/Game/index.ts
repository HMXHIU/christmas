import Root from "./Game.svelte";

import {
    getPlayerPosition,
    type Position,
} from "$lib/components/crossover/Game/utils";
import { addMessageFeed } from "$lib/components/crossover/GameWindow";
import { crossoverWorldWorlds } from "$lib/crossover/client";
import { executeGameCommand } from "$lib/crossover/game";
import type { GameCommand } from "$lib/crossover/ir";
import type { Actor, Item, Monster, Player } from "$lib/crossover/types";
import {
    geohashToColRow,
    getEntityId,
    isEntityEquipment,
    isEntityEquipmentOrInventory,
} from "$lib/crossover/utils";
import { worldSeed } from "$lib/crossover/world/settings/world";
import {
    geohashLocationTypes,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import { AsyncLock } from "$lib/utils";
import type { HTTPHeaders } from "@trpc/client";
import { groupBy, isEqual } from "lodash-es";
import { Container, type Application } from "pixi.js";
import { get, type Writable } from "svelte/store";
import {
    equipmentRecord,
    itemRecord,
    landGrading,
    monsterRecord,
    player,
    playerEquippedItems,
    playerInventoryItems,
    playerRecord,
    worldOffset,
    worldRecord,
} from "../../../../store";
import { calculateLandGrading } from "./biomes";
import {
    cullEntityContainerById,
    entityContainers,
    entitySigils,
    garbageCollectEntityContainers,
    upsertEntityContainer,
    upsertEntitySigil,
} from "./entities";
import { AvatarEntityContainer } from "./entities/AvatarEntityContainer";
import { garbageCollectWorldEntityContainers } from "./world";

export {
    calibrateWorldOffset,
    tryExecuteGameCommand,
    updateEntities,
    updateWorlds,
    type GameLogic,
};

export default Root;

interface GameLogic {
    app: Application;
    stage: Container;
    handlePlayerPositionUpdate: (
        oldPosition: Position | null,
        newPosition: Position,
    ) => Promise<void>;
    handleTrackPlayer: (params: {
        position: Position;
        duration?: number;
    }) => Promise<void>;
}

function calibrateWorldOffset(geohash: string) {
    const [col, row] = geohashToColRow(geohash);
    worldOffset.set({ col: col, row: row });
}

/**
 * Call this to update wordRecord when player moves to a new town
 *
 * @param geohash - geohash of the player
 * @returns
 */
async function updateWorlds(geohash: string, locationType: GeohashLocation) {
    const t = geohash.slice(0, worldSeed.spatial.town.precision);
    // Already have world at town (Note: no world in town ({} is valid))
    if (get(worldRecord)[t] != null) {
        return;
    }

    // Get world at town
    const { town, worlds } = await crossoverWorldWorlds(geohash, locationType);
    worldRecord.update((wr) => {
        if (wr[town] == null) {
            wr[town] = {};
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
function displayEntityEffects<T extends Actor>(
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
async function updateEntityContainer<T extends Actor>(
    oldEntity: T | null,
    newEntity: T,
    game: GameLogic,
) {
    updateEntityContainerLock.withLock(async () => {
        if (geohashLocationTypes.has(newEntity.locT)) {
            // Update entity container
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
                    const avatar = (ec as AvatarEntityContainer).avatar;

                    // Attach game events
                    ec.on("positionUpdate", game.handlePlayerPositionUpdate);
                    ec.on("trackEntity", game.handleTrackPlayer);

                    // Initial event
                    if (ec.isoPosition != null) {
                        game.handlePlayerPositionUpdate(null, ec.isoPosition);
                        game.handleTrackPlayer({ position: ec.isoPosition });
                    }

                    // Create sigil (at bottom left)
                    if (avatar) {
                        const sigil = await upsertEntitySigil(
                            ec,
                            game.app.stage,
                        );
                        const bounds = sigil.getBounds();
                        const padding = 10;
                        sigil.position.set(
                            padding,
                            game.app.screen.height -
                                padding -
                                bounds.height / 2,
                        );
                    }
                }
            }

            // Update sigils (only upsert if already created as we dont want sigils for every entity)
            if (entitySigils[ec.entityId]) {
                entitySigils[ec.entityId].updateUI();
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
        if (
            oldEntity == null ||
            oldEntity.loc[0] !== newEntity.loc[0] ||
            oldEntity.locT !== newEntity.locT ||
            oldEntity.locI !== newEntity.locI
        ) {
            await updateWorlds(
                newEntity.loc[0],
                newEntity.locT as GeohashLocation,
            );
        }
    }
}

/**
 * Update the equipment record for all entities
 *
 * @param oldItem - Old Entity before change
 * @param newItem - New Entity after change
 */
async function updateEquipment(
    oldItem: Item | null,
    newItem: Item,
    game: GameLogic,
) {
    if (!geohashLocationTypes.has(newItem.locT)) {
        equipmentRecord.update((er) => {
            // Minified entity might not contain location information, need to check if present
            if (isEntityEquipment(newItem)) {
                const creatureId = newItem.loc[0]; // this is the creature the item is on
                if (er[creatureId]) {
                    er[creatureId][newItem.item] = newItem;
                } else {
                    er[creatureId] = {
                        [newItem.item]: newItem,
                    };
                }
            }
            return er;
        });
    }
}

function loadInventory(record: Record<string, Item>) {
    const playerId = get(player)?.player;
    for (const [creatureId, items] of Object.entries(
        groupBy(
            Object.values(record).filter(isEntityEquipmentOrInventory),
            (i) => i.loc[0],
        ),
    )) {
        const ec = entityContainers[creatureId];
        if (ec && ec instanceof AvatarEntityContainer) {
            ec.loadInventory(items);
        }

        // Set player (self) equipment & inventory
        if (playerId === creatureId) {
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
            onComplete: async (record) => {
                // Load player inventory
                loadInventory(record);

                // Update the land grading
                const updatedLandGrading = await calculateLandGrading(
                    Object.values(record),
                );

                // If the land grading has changed,
                if (!isEqual(updatedLandGrading, landGrading)) {
                    landGrading.set(updatedLandGrading);
                }
            },
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
                updatePlayer, // update player (self)
                updateEntityContainer,
                displayEntityEffects,
            ],
        });
    }

    // Garbage collect irrelevant ecs, the player might have moved to a different `locT`
    const position = getPlayerPosition();
    if (position) {
        garbageCollectEntityContainers(position);
        garbageCollectWorldEntityContainers(position);
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

async function tryExecuteGameCommand(
    command: GameCommand,
    headers: HTTPHeaders = {},
): Promise<void> {
    try {
        await executeGameCommand(command, headers);
    } catch (error: any) {
        addMessageFeed({
            message: error.message,
            name: "Error",
            messageFeedType: "error",
        });
    }
}
