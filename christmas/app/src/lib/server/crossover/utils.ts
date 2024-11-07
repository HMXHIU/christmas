import { PUBLIC_ENVIRONMENT } from "$env/static/public";
import type { Creature } from "$lib/crossover/types";
import { geohashNeighbour } from "$lib/crossover/utils";
import { type ItemVariables } from "$lib/crossover/world/compendium";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type { Direction, GeohashLocation } from "$lib/crossover/world/types";
import { isGeohashTraversable } from "$lib/crossover/world/utils";
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
} from "$lib/server/crossover/caches";
import type {
    ActorEntity,
    CreatureEntity,
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
    WorldEntity,
} from "$lib/server/crossover/types";
import { itemRepository, monsterRepository, playerRepository } from "./redis";
import {
    hasCollidersAtLocation,
    worldsContainingGeohashQuerySet,
} from "./redis/queries";

export {
    entityIsBusy,
    hasItemConfigOwnerPermissions,
    hasItemOwnerPermissions,
    isDirectionTraversable,
    isGeohashTraversableServer,
    isLocationTraversable,
    itemVariableValue,
    parseItemVariables,
    random,
};

function entityIsBusy(entity: Creature): [boolean, number] {
    const now = Date.now();
    if (entity.buclk > now) {
        return [true, now];
    }
    return [false, now];
}

async function getWorldAtLocation(
    geohash: string,
    locationType: GeohashLocation,
    locationInstance: string,
): Promise<WorldEntity | undefined> {
    return (await worldsContainingGeohashQuerySet(
        [geohash],
        locationType,
        locationInstance,
    ).first()) as WorldEntity | undefined;
}

async function isGeohashTraversableServer(
    geohash: string,
    locationType: GeohashLocation,
    locationInstance: string,
): Promise<boolean> {
    return await isGeohashTraversable(
        geohash,
        locationType,
        locationInstance,
        hasCollidersAtLocation,
        getWorldAtLocation,
        {
            topologyResultCache,
            topologyBufferCache,
            topologyResponseCache,
            worldTraversableCellsCache,
            worldAssetMetadataCache,
            biomeAtGeohashCache,
            biomeParametersAtCityCache,
            dungeonGraphCache,
            dungeonsAtTerritoryCache,
        },
    );
}

async function isLocationTraversable(
    location: string[],
    locationType: GeohashLocation,
    locationInstance: string,
): Promise<boolean> {
    for (const geohash of location) {
        if (
            !(await isGeohashTraversableServer(
                geohash,
                locationType,
                locationInstance,
            ))
        ) {
            return false;
        }
    }
    return true;
}

async function isDirectionTraversable(
    loc: string[], // entity might be more than 1 cell in size
    locationType: GeohashLocation,
    locationInstance: string,
    direction: Direction,
): Promise<[boolean, string[]]> {
    let location: string[] = [];

    // Check all cells are able to move (location might include more than 1 cell for large entities)
    for (const geohash of loc) {
        const nextGeohash = geohashNeighbour(geohash, direction);

        // Within own location is always traversable
        if (loc.includes(nextGeohash)) {
            location.push(nextGeohash);
            continue;
        }

        // Check if geohash is traversable
        if (
            !(await isGeohashTraversableServer(
                nextGeohash,
                locationType,
                locationInstance,
            ))
        ) {
            return [false, loc]; // early return if not traversable
        } else {
            location.push(nextGeohash);
        }
    }
    return [true, location];
}

function hasItemOwnerPermissions(item: ItemEntity, self: CreatureEntity) {
    return (
        item.own === "" || item.own === self.player || item.own === self.monster
    );
}

function hasItemConfigOwnerPermissions(item: ItemEntity, self: CreatureEntity) {
    return (
        item.cfg === "" || item.cfg === self.player || item.cfg === self.monster
    );
}

function parseItemVariables(
    variables: ItemVariables,
    prop: string,
): ItemVariables {
    const propVariables = compendium[prop].variables;
    let itemVariables: ItemVariables = {};

    for (const [key, value] of Object.entries(variables)) {
        if (propVariables.hasOwnProperty(key)) {
            const { type } = propVariables[key];
            if (["string", "item", "monster", "player"].includes(type)) {
                itemVariables[key] = String(value);
            } else if (type === "number") {
                itemVariables[key] = Number(value);
            } else if (type === "boolean") {
                itemVariables[key] = Boolean(value);
            }
        }
    }

    return itemVariables;
}

async function itemVariableValue(
    item: ItemEntity,
    key: string,
): Promise<string | number | boolean | ActorEntity> {
    const itemVariables = item.vars;
    const propVariables = compendium[item.prop].variables;
    const { type, value: defaultValue } = propVariables[key];
    const variable = itemVariables[key] ?? defaultValue;

    if (type === "item") {
        return (await itemRepository.fetch(variable as string)) as ItemEntity;
    } else if (type === "player") {
        return (await playerRepository.fetch(
            variable as string,
        )) as PlayerEntity;
    } else if (type === "monster") {
        return (await monsterRepository.fetch(
            variable as string,
        )) as MonsterEntity;
    } else if (type === "string") {
        return String(variable);
    } else if (type === "number") {
        return Number(variable);
    } else if (type === "boolean") {
        return Boolean(variable);
    }

    throw new Error(`Invalid variable type ${type} for item ${item.item}`);
}

function random() {
    if (PUBLIC_ENVIRONMENT === "development") {
        return 0.5;
    }
    return Math.random();
}
