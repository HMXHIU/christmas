import {
    entityInRange,
    geohashToColRow,
    getEntityId,
    gridCellToGeohash,
} from "$lib/crossover/utils";
import type {
    Item,
    Monster,
    Player,
    World,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import type { HTTPHeaders } from "@trpc/client";
import { get } from "svelte/store";
import { ctaRecord, itemRecord, player, worldRecord } from "../../store";
import {
    biomeAtGeohashCache,
    biomeParametersAtCityCache,
    dungeonGraphCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
    worldAssetMetadataCache,
    worldTraversableCellsCache,
} from "./caches";
import {
    crossoverCmdAccept,
    crossoverCmdConfigureItem,
    crossoverCmdCreateItem,
    crossoverCmdDrop,
    crossoverCmdEnterItem,
    crossoverCmdEquip,
    crossoverCmdLearn,
    crossoverCmdLook,
    crossoverCmdMove,
    crossoverCmdPerformAbility,
    crossoverCmdRest,
    crossoverCmdSay,
    crossoverCmdTake,
    crossoverCmdTrade,
    crossoverCmdUnequip,
    crossoverCmdUseItem,
    crossoverCmdWrit,
    crossoverPlayerInventory,
} from "./client";
import { type GameCommand, type GameCommandVariables } from "./ir";
import { aStarPathfinding } from "./pathfinding";
import type { Ability } from "./world/abilities";
import { actions, type Action } from "./world/actions";
import type { Utility } from "./world/compendium";
import { MS_PER_TICK, SERVER_LATENCY } from "./world/settings";
import { compendium } from "./world/settings/compendium";
import { worldSeed } from "./world/settings/world";
import { type SkillLines } from "./world/skills";
import {
    Directions,
    EquipmentSlots,
    type BarterSerialized,
    type Direction,
    type EquipmentSlot,
    type GeohashLocationType,
} from "./world/types";
import { isGeohashTraversable } from "./world/utils";

export {
    executeGameCommand,
    getDirectionsToPosition,
    isGeohashTraversableClient,
    moveInRangeOfTarget,
    performAction,
};

const pinRegex = /\b\d+\b/;

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

    if (playerEntity.locT !== target.locT) {
        throw new Error("Player and target are not in the same location type");
    }

    if (entityInRange(playerEntity, target, range)[0]) {
        return;
    }

    // Move in range of target
    const targetGeohash = target.loc[0]; // TODO: consider entities with loc more than 1 cell
    const sourceGeohash = playerEntity.loc[0];
    const [targetCol, targetRow] = geohashToColRow(targetGeohash);
    const [sourceCol, sourceRow] = geohashToColRow(sourceGeohash);
    const path = await getDirectionsToPosition(
        {
            row: sourceRow,
            col: sourceCol,
        },
        {
            row: targetRow,
            col: targetCol,
        },
        target.locT as GeohashLocationType,
        target.locI,
        { range },
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
    const [
        gameAction,
        { self, target, item, skill, offer, receive },
        variables,
    ] = command;

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
                utility: (gameAction as Utility).utility,
            },
            headers,
        );
    }
    // Perform ability
    else if ("ability" in gameAction) {
        const ability = gameAction as Ability;

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
    else if ("action" in gameAction) {
        return await performAction(
            {
                self,
                action: gameAction as Action,
                target,
                skill,
                variables,
            },
            headers,
        );
    }
}

async function performAction(
    {
        self,
        action,
        target,
        skill,
        variables,
        offer,
        receive,
    }: {
        action: Action;
        self: Player | Monster;
        target?: Player | Monster | Item;
        skill?: SkillLines;
        offer?: BarterSerialized;
        receive?: BarterSerialized;
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
            {
                message: variables.queryIrrelevant,
                target: target ? getEntityId(target)[0] : undefined,
            },
            headers,
        );
    }
    // accept
    else if (action.action === "accept" && variables != null) {
        // Find pin in query
        const match = variables.queryIrrelevant.match(pinRegex);
        if (!match) {
            throw new Error(`What are you trying to accept?`);
        }
        const pin = match[0];

        // Find cta
        const cta = get(ctaRecord)[pin];
        if (!cta) {
            throw new Error(`There is no ${pin} to accept.`);
        }

        // Execute the cta
        return await crossoverCmdAccept({ token: cta.token }, headers);
    }
    // buy & sell
    else if (
        action.action === "buy" ||
        (action.action === "sell" && variables != null)
    ) {
        if (!offer || !receive) {
            throw new Error(`What are you trying to ${action.action}?`);
        }

        return await crossoverCmdTrade(
            {
                buyer:
                    action.action === "buy"
                        ? getEntityId(self)[0]
                        : getEntityId(target!)[0],
                seller:
                    action.action === "sell"
                        ? getEntityId(self)[0]
                        : getEntityId(target!)[0],
                offer,
                receive,
            },
            headers,
        );
    }
    // writ
    else if (action.action === "writ" && variables != null) {
        // Get order
        let order: "buy" | "sell" | undefined = undefined;
        if (variables.queryIrrelevant.includes("buy")) {
            order = "buy";
        } else if (variables.queryIrrelevant.includes("sell")) {
            order = "sell";
        }
        if (!order) {
            throw new Error(`You must specify a buy or sell order`);
        }

        if (!offer || !receive) {
            throw new Error(`What are you trying to ${order}?`);
        }

        return await crossoverCmdWrit(
            {
                buyer: order === "buy" ? getEntityId(self)[0] : "", // anyone can fulfill
                seller: order === "sell" ? getEntityId(self)[0] : "", // anyone can fulfill
                offer,
                receive,
            },
            headers,
        );
    }
    // learn
    else if (action.action === "learn") {
        const teacher = target ? getEntityId(target)[0] : undefined;
        if (!teacher) {
            throw new Error(`Who are you trying to learn from?`);
        }
        if (!skill) {
            throw new Error(`What are you trying to learn?`);
        }
        return await crossoverCmdLearn(
            {
                skill,
                teacher,
            },
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
                    locationType: self.locT as GeohashLocationType,
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
    // enter
    else if (action.action === "enter") {
        return await crossoverCmdEnterItem(
            { item: getEntityId(target as Item)[0] },
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

async function getTraversalCost(
    row: number,
    col: number,
    locationType: GeohashLocationType,
    locationInstance: string,
    precision?: number,
): Promise<number> {
    // 0 is walkable, 1 is not
    return (await isGeohashTraversableClient(
        gridCellToGeohash({
            col,
            row,
            precision: precision ?? worldSeed.spatial.unit.precision,
        }),
        locationType,
        locationInstance,
    ))
        ? 0
        : 1;
}

async function hasColliders(
    geohash: string,
    locationType: GeohashLocationType,
    locationInstance: string,
): Promise<boolean> {
    for (const item of Object.values(get(itemRecord))) {
        if (
            item.locT === locationType &&
            item.loc.includes(geohash) &&
            item.locI === locationInstance
        ) {
            return true;
        }
    }
    return false;
}

async function getWorldForGeohash(
    geohash: string,
    locationType: GeohashLocationType,
): Promise<World | undefined> {
    for (const [town, worlds] of Object.entries(get(worldRecord))) {
        if (!geohash.startsWith(town)) continue;
        for (const world of Object.values(worlds)) {
            for (const loc of world.loc) {
                if (geohash.startsWith(loc) && world.locT === locationType) {
                    return world;
                }
            }
        }
    }
    return undefined;
}

async function isGeohashTraversableClient(
    geohash: string,
    locationType: GeohashLocationType,
    locationInstance: string,
): Promise<boolean> {
    return isGeohashTraversable(
        geohash,
        locationType,
        locationInstance,
        hasColliders,
        getWorldForGeohash,
        {
            topologyResponseCache,
            topologyResultCache,
            topologyBufferCache,
            worldAssetMetadataCache,
            worldTraversableCellsCache,
            biomeAtGeohashCache,
            biomeParametersAtCityCache,
            dungeonGraphCache,
        },
    );
}

async function getDirectionsToPosition(
    source: { row: number; col: number },
    target: { row: number; col: number },
    locationType: GeohashLocationType,
    locationInstance: string,
    options?: {
        range?: number;
        precision?: number;
    },
): Promise<Direction[]> {
    return await aStarPathfinding({
        colStart: source.col,
        rowStart: source.row,
        colEnd: target.col,
        rowEnd: target.row,
        range: options?.range,
        getTraversalCost: (row, col) =>
            getTraversalCost(
                row,
                col,
                locationType,
                locationInstance,
                options?.precision,
            ),
    });
}
