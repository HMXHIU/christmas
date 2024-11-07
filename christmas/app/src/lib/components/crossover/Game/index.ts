import Root from "./Game.svelte";

import {
    getPlayerLocation,
    type Location,
    type Position,
} from "$lib/components/crossover/Game/utils";
import { addMessageFeed } from "$lib/components/crossover/GameWindow";
import { executeGameCommand } from "$lib/crossover/game";
import type { GameCommand } from "$lib/crossover/ir";
import { entityLinguistics } from "$lib/crossover/mud/entities";
import type { Actor, Item, Monster, Player } from "$lib/crossover/types";
import {
    geohashToColRow,
    getEntityId,
    isEntityEquipment,
    isEntityEquipmentOrInventory,
} from "$lib/crossover/utils";
import {
    conditions,
    expireConditions,
    type Condition,
} from "$lib/crossover/world/combat";
import { geohashLocationTypes } from "$lib/crossover/world/types";
import { AsyncLock, substituteVariables } from "$lib/utils";
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
    target,
    worldOffset,
} from "../../../../store";
import { calculateLandGrading } from "./biomes";
import {
    cullEntityContainerById,
    entityContainers,
    entitySigils,
    garbageCollectECs,
    upsertEntityContainer,
    upsertEntitySigil,
} from "./entities";
import { AvatarEntityContainer } from "./entities/AvatarEntityContainer";
import { hideMovementPath } from "./ui";
import { garbageCollectWorldECs } from "./world";

export {
    calibrateWorldOffset,
    tryExecuteGameCommand,
    updateEntities,
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
        startPosition: Position | null;
        position: Position;
        duration?: number;
    }) => Promise<void>;
}

function calibrateWorldOffset(geohash: string) {
    const [col, row] = geohashToColRow(geohash);
    worldOffset.set({ col: col, row: row });
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

    // The most updated player location is required
    const selfPlayer = get(player);
    if (!selfPlayer) return;
    const location = players
        ? getPlayerLocation(
              players.find((p) => p.player === selfPlayer.player) ?? selfPlayer,
          )
        : getPlayerLocation(selfPlayer);

    // Update itemRecord
    if (items?.length) {
        updateRecord<Item>(itemRecord, items, "item", op, game, location, {
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
        updateRecord<Monster>(
            monsterRecord,
            monsters,
            "monster",
            op,
            game,
            location,
            {
                handleChanged: [updateEntityContainer, displayEntityEffects],
            },
        );
    }

    // Update playerRecord
    if (players?.length) {
        updateRecord<Player>(
            playerRecord,
            players,
            "player",
            op,
            game,
            location,
            {
                handleChanged: [
                    updatePlayer,
                    updateEntityContainer,
                    displayEntityEffects,
                ],
            },
        );
    }

    // Garbage collect
    garbageCollect(location);
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
    location: Location,
) {
    // If just created don't display effects
    if (oldEntity == null) return;

    // Generate combat messages if entity is self or target
    const [entityId, _] = getEntityId(newEntity);
    const t = get(target);
    const p = get(player);
    if ((p && p.player === entityId) || (t && getEntityId(t)[0] === entityId)) {
        const newConditions = new Set(
            expireConditions(newEntity.cond).map((s) => s.split(":")[1]),
        );
        const oldConditions = new Set(
            expireConditions(oldEntity.cond).map((s) => s.split(":")[1]),
        );

        // Added conditions
        for (const cond of newConditions.difference(oldConditions)) {
            const dialogue = conditions[cond as Condition].dialogue;
            if (dialogue) {
                addMessageFeed({
                    message: substituteVariables(
                        dialogue.added,
                        entityLinguistics(newEntity, p?.player),
                    ),
                    name: "",
                    messageFeedType: "combat",
                });
            }
        }

        // Removed conditions
        for (const cond of oldConditions.difference(newConditions)) {
            const dialogue = conditions[cond as Condition].dialogue;
            if (dialogue) {
                addMessageFeed({
                    message: substituteVariables(
                        dialogue.removed,
                        entityLinguistics(newEntity, p?.player),
                    ),
                    name: "",
                    messageFeedType: "combat",
                });
            }
        }
    }

    // TODO: Display UI effects

    // Monster
    if ("monster" in oldEntity) {
        // const deltaHp = oldEntity.hp - (newEntity as Monster).hp;
        // if (deltaHp > 0) {
        //     addMessageFeed({
        //         message: `${oldEntity.monster} lost ${deltaHp} HP`,
        //         name: "",
        //         messageFeedType: "combat",
        //     });
        // }
    }
    // Player
    else if ("player" in oldEntity) {
        // const deltaHp = oldEntity.hp - (newEntity as Player).hp;
        // if (deltaHp > 0) {
        //     addMessageFeed({
        //         message: `${oldEntity.player} lost ${deltaHp} HP`,
        //         name: "",
        //         messageFeedType: "combat",
        //     });
        // }
    }
    // Item
    else if ("item" in oldEntity) {
    }
}

const updateEntityContainerLock = new AsyncLock();
async function updateEntityContainer<T extends Actor>(
    oldEntity: T | null,
    newEntity: T,
    game: GameLogic,
    location: Location,
) {
    updateEntityContainerLock.withLock(async () => {
        // Check entity in same location as player
        if (
            location.locationInstance !== newEntity.locI ||
            location.locationType !== newEntity.locT
        ) {
            cullEntityContainerById(getEntityId(newEntity)[0]);
            return;
        }

        // Update entity container
        const [created, ec] = await upsertEntityContainer(
            newEntity,
            game.stage,
        );

        // Initialize entity if newly created (ec could have been GCed)
        if (created) {
            // Load player equipment
            if (ec instanceof AvatarEntityContainer) {
                const entityEquipment = get(equipmentRecord)[ec.entityId];
                if (entityEquipment) {
                    ec.loadInventory(Object.values(entityEquipment));
                }
            }

            // Player (self)
            if (ec.entityId === get(player)?.player) {
                // Attach game events
                ec.on("positionUpdate", game.handlePlayerPositionUpdate);
                ec.on("trackEntity", game.handleTrackPlayer); // this is to call the camera to track the player
                ec.on("pathCompleted", hideMovementPath);

                // Initial event
                if (ec.isoPosition != null) {
                    game.handlePlayerPositionUpdate(null, ec.isoPosition);
                    game.handleTrackPlayer({
                        startPosition: null,
                        position: ec.isoPosition,
                    });
                }

                // Create sigil (at bottom left)
                const avatar = (ec as AvatarEntityContainer).avatar;
                if (avatar) {
                    const sigil = await upsertEntitySigil(ec, game.app.stage);
                    const bounds = sigil.getBounds();
                    const padding = 15;
                    sigil.position.set(
                        padding,
                        game.app.screen.height - bounds.height - bounds.height,
                    );
                }
            }
        }

        // Update sigils (only upsert if already created as we dont want sigils for every entity)
        if (entitySigils[ec.entityId]) {
            entitySigils[ec.entityId].updateUI();
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
    location: Location,
) {
    // Update player (self)
    if (newEntity.player === get(player)?.player) {
        player.set(newEntity);
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
    location: Location,
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

function updateRecord<T extends { [key: string]: any }>(
    record: Writable<Record<string, T>>,
    entities: T[],
    idKey: keyof T & string,
    op: "upsert" | "replace",
    game: GameLogic,
    location: Location,
    callbacks?: {
        handleChanged?: ((
            oldEntity: T | null,
            newEntity: T,
            game: GameLogic,
            location: Location,
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
                    for (const handleChanged of callbacks?.handleChanged) {
                        handleChanged(
                            newRecord[entityId],
                            updatedEnity,
                            game,
                            location,
                        );
                    }
                }
                newRecord[entityId] = updatedEnity;
            }
            // Create entity
            else {
                if (callbacks?.handleChanged) {
                    for (const handleChanged of callbacks?.handleChanged) {
                        handleChanged(null, entity, game, location);
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

function garbageCollect(location: Location) {
    garbageCollectECs(location);
    garbageCollectWorldECs(location);
}
