import type {
    Actor,
    Creature,
    Item,
    Monster,
    Player,
    World,
} from "$lib/crossover/types";
import { getEntityId, gridCellToGeohash } from "$lib/crossover/utils";
import type { HTTPHeaders } from "@trpc/client";
import { get } from "svelte/store";
import { ctaRecord, itemRecord, worldRecord } from "../../store";
import {
    biomeAtGeohashCache,
    biomeParametersAtCityCache,
    dungeonGraphCache,
    dungeonsAtTerritoryCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
    worldAssetMetadataCache,
    worldTraversableCellsCache,
} from "./caches";
import {
    crossoverCmdAccept,
    crossoverCmdAttack,
    crossoverCmdBrowse,
    crossoverCmdCapture,
    crossoverCmdConfigureItem,
    crossoverCmdCreateItem,
    crossoverCmdDrop,
    crossoverCmdEnterItem,
    crossoverCmdEquip,
    crossoverCmdFulfill,
    crossoverCmdGive,
    crossoverCmdLearn,
    crossoverCmdLook,
    crossoverCmdMove,
    crossoverCmdRest,
    crossoverCmdSay,
    crossoverCmdTake,
    crossoverCmdTrade,
    crossoverCmdUnequip,
    crossoverCmdUseAbility,
    crossoverCmdUseItem,
    crossoverCmdWrit,
    crossoverPlayerInventory,
    crossoverWorldWorlds,
} from "./client";
import {
    getGameActionId,
    type GameCommand,
    type GameCommandVariables,
} from "./ir";
import { aStarPathfinding } from "./pathfinding";
import type { Ability } from "./world/abilities";
import { type Action } from "./world/actions";
import type { Utility } from "./world/compendium";
import { compendium } from "./world/settings/compendium";
import { worldSeed } from "./world/settings/world";
import { type SkillLines } from "./world/skills";
import {
    Directions,
    type BarterSerialized,
    type Direction,
    type GeohashLocation,
    type LocationType,
} from "./world/types";
import { isGeohashTraversable } from "./world/utils";

export {
    executeGameCommand,
    getDirectionsToPosition,
    getWorldsAtLocation,
    isGeohashTraversableClient,
    performAction,
};

const pinRegex = /\b\d+\b/;

async function executeGameCommand(
    command: GameCommand,
    headers: HTTPHeaders = {},
): Promise<void> {
    const [
        gameAction,
        { self, target, item, skill, offer, receive },
        variables,
    ] = command;

    const [actionId, actionType] = getGameActionId(gameAction);

    // Use item utility
    if (actionType === "utility" && item != null) {
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
    else if (actionType === "ability") {
        const ability = gameAction as Ability;

        // Perform ability
        return await crossoverCmdUseAbility(
            {
                target:
                    (target as Player)?.player ||
                    (target as Monster)?.monster ||
                    (target as Item)?.item ||
                    undefined,
                ability: ability.ability,
            },
            headers,
        );
    }
    // Action (variables are required)
    else if (actionType === "action") {
        return await performAction(
            {
                self,
                action: gameAction as Action,
                target,
                skill,
                variables,
                offer,
                receive,
                item,
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
        item,
    }: {
        action: Action;
        self: Creature;
        target?: Actor;
        skill?: SkillLines;
        item?: Item;
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
    // attack
    else if (action.action === "attack") {
        if (!target) {
            throw new Error(`What are you trying to attack?`);
        }
        return await crossoverCmdAttack(
            { target: getEntityId(target)[0] },
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
    // trade
    else if (action.action === "trade") {
        if (!offer || !receive) {
            throw new Error(`What are you trying to trade?`);
        }
        return await crossoverCmdTrade(
            {
                buyer: getEntityId(self)[0],
                seller: getEntityId(target!)[0],
                offer,
                receive,
            },
            headers,
        );
    }
    // writ
    else if (action.action === "writ" && variables != null) {
        if (!offer || !receive) {
            throw new Error(`What are you trying to trade?`);
        }

        return await crossoverCmdWrit(
            {
                buyer: getEntityId(self)[0],
                seller: "", // anyone can fulfill
                offer,
                receive,
            },
            headers,
        );
    }
    // fulfill
    else if (action.action === "fulfill") {
        if (!target || (target as Item).prop !== compendium.tradewrit.prop) {
            throw new Error(`What writ are you trying to fulfill?`);
        }
        return await crossoverCmdFulfill(
            {
                item: (target as Item).item,
            },
            headers,
        );
    }
    // give
    else if (action.action === "give") {
        const receiver = target ? getEntityId(target)[0] : undefined;
        if (!receiver) {
            throw new Error(`Whom are you to giving to?`);
        }
        if (!item) {
            throw new Error(`What are you trying to give?`);
        }
        return await crossoverCmdGive(
            {
                item: item.item,
                receiver,
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
        const item = target as Item;
        return await crossoverCmdEquip(
            {
                item: item.item,
            },
            headers,
        );
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
        if (Object.keys(compendium).includes(prop)) {
            return await crossoverCmdCreateItem({ prop: prop }, headers);
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
    // browse
    else if (action.action === "browse") {
        if (!target || !(target as Player).player) {
            throw new Error(`Who are you browsing?`);
        }
        return await crossoverCmdBrowse({ player: (target as Player).player });
    }
    // capture
    else if (action.action === "capture") {
        if (!target || !(target as Item).item) {
            throw new Error(`What are you trying to capture?`);
        }
        if (!offer) {
            throw new Error(`An offering is required.`);
        }
        return await crossoverCmdCapture(
            {
                target: (target as Item).item,
                offer,
            },
            headers,
        );
    }

    throw new Error(`Unknown action ${action}`);
}

async function getTraversalCostClient(
    row: number,
    col: number,
    locationType: GeohashLocation,
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
    locationType: GeohashLocation,
    locationInstance: string,
): Promise<boolean> {
    for (const item of Object.values(get(itemRecord))) {
        if (
            item.locT === locationType &&
            item.loc.includes(geohash) &&
            item.locI === locationInstance &&
            item.cld
        ) {
            return true;
        }
    }
    return false;
}

function groupLocationKey(
    geohash: string,
    locationType: LocationType,
    locationInstance: string,
): string {
    return `${geohash}-${locationType}-${locationInstance}`;
}

async function getWorldsAtLocation({
    geohash,
    locationInstance,
    locationType,
}: {
    geohash: string;
    locationInstance: string;
    locationType: GeohashLocation;
}): Promise<Record<string, World>> {
    // All worlds at locT=geohash are at town precision (5p)
    let town = geohash.slice(0, worldSeed.spatial.town.precision);

    // Check have world at location (Note: check null, as {} means no worlds at location)
    const locationKey = groupLocationKey(town, locationType, locationInstance);
    const ws = get(worldRecord)[locationKey];
    if (ws != null) {
        return ws;
    }

    // Fetch worlds at location
    const { worlds } = await crossoverWorldWorlds(
        town,
        locationType,
        locationInstance,
    );

    worldRecord.update((wr) => {
        wr[locationKey] = wr[locationKey] ?? {};
        for (const w of worlds) {
            wr[locationKey][w.world] = w;
        }
        return wr;
    });

    return get(worldRecord)[locationKey] ?? {};
}

async function getWorldAtLocation(
    geohash: string,
    locationType: GeohashLocation,
    locationInstance: string,
): Promise<World | undefined> {
    const worlds = await getWorldsAtLocation({
        geohash,
        locationInstance,
        locationType,
    });
    for (const world of Object.values(worlds)) {
        for (const loc of world.loc) {
            if (
                geohash.startsWith(loc) &&
                world.locT === locationType &&
                world.locI == locationInstance
            ) {
                return world;
            }
        }
    }
    return undefined;
}

async function isGeohashTraversableClient(
    geohash: string,
    locationType: GeohashLocation,
    locationInstance: string,
): Promise<boolean> {
    return await isGeohashTraversable(
        geohash,
        locationType,
        locationInstance,
        hasColliders,
        getWorldAtLocation,
        {
            topologyResponseCache,
            topologyResultCache,
            topologyBufferCache,
            worldAssetMetadataCache,
            worldTraversableCellsCache,
            biomeAtGeohashCache,
            biomeParametersAtCityCache,
            dungeonGraphCache,
            dungeonsAtTerritoryCache,
        },
    );
}

async function getDirectionsToPosition(
    source: { row: number; col: number },
    target: { row: number; col: number },
    locationType: GeohashLocation,
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
            getTraversalCostClient(
                row,
                col,
                locationType,
                locationInstance,
                options?.precision,
            ),
    });
}
