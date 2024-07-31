import Root from "./Game.svelte";

import { getDirectionsToPosition } from "$lib/components/crossover/Game/utils";
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
import { MS_PER_TICK, SERVER_LATENCY } from "$lib/crossover/world/settings";
import { Directions, type Direction } from "$lib/crossover/world/types";
import { worldSeed } from "$lib/crossover/world/world";
import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import type { HTTPHeaders } from "@trpc/client";
import { get, type Writable } from "svelte/store";
import {
    itemRecord,
    monsterRecord,
    player,
    playerRecord,
    worldRecord,
} from "../../../../store";

export { executeGameCommand, handleUpdateEntities, updateWorlds };

export default Root;

async function updateWorlds(geohash: string) {
    const t = geohash.slice(0, worldSeed.spatial.town.precision);
    if (get(worldRecord)[t] != null) {
        return;
    }
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

async function updatePlayer(
    p: Player,
    op: "upsert" | "replace",
    handleChanged?: (oldEntity: Player, newEntity: Player) => void,
) {
    const oldPlayer = get(player);
    const newPlayer = op === "replace" ? p : { ...oldPlayer, ...p };
    if (handleChanged && oldPlayer) {
        handleChanged(oldPlayer, newPlayer);
    }
    player.set(newPlayer);
}

async function handlePlayerChanged(before: Player, after: Player) {
    // Update world on location changed
    if (before.loc[0] !== after.loc[0]) {
        await updateWorlds(after.loc[0]);
    }
}

function displayEntityEffects<T extends Player | Monster | Item>(
    oldEntity: T,
    newEntity: T,
) {
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
        console.log("ITEM CHANGTED", oldEntity, newEntity);
    }
}

function updateRecord<T extends { [key: string]: any }>(
    record: Writable<Record<string, T>>,
    entities: T[],
    idKey: keyof T & string,
    op: "upsert" | "replace",
    handleChanged?: (oldEntity: T, newEntity: T) => void,
) {
    record.update((r) => {
        // Replace entire record
        const newRecord = op === "replace" ? {} : r;

        for (const entity of entities) {
            const entityId = entity[idKey];
            // Update entity
            if (newRecord[entityId]) {
                const updatedEnity = { ...newRecord[entityId], ...entity };
                if (handleChanged) {
                    handleChanged(newRecord[entityId], updatedEnity);
                }
            }
            // Create entity
            else {
                newRecord[entityId] = entity;
            }
        }
        return newRecord;
    });
}

function handleUpdateEntities(
    {
        players,
        items,
        monsters,
    }: {
        players?: Player[];
        items?: Item[];
        monsters?: Monster[];
    },
    op: "upsert" | "replace" = "upsert",
) {
    if (players?.length) {
        const self = get(player);

        // Update player
        const p = players.find((p) => p.player === self?.player);
        if (p != null) {
            updatePlayer(p, op, handlePlayerChanged);
        }

        // Update playerRecord (excluding self)
        const otherPlayers = players.filter((p) => p.player !== self?.player);
        if (otherPlayers.length) {
            updateRecord<Player>(playerRecord, otherPlayers, "player", op);
        }
    }

    // Update itemRecord
    if (items?.length) {
        updateRecord<Item>(itemRecord, items, "item", op, displayEntityEffects);
    }

    // Update monsterRecord
    if (monsters?.length) {
        updateRecord<Monster>(
            monsterRecord,
            monsters,
            "monster",
            op,
            displayEntityEffects,
        );
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
