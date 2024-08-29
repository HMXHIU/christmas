import { createClient } from "redis";

import {
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    REDIS_USERNAME,
} from "$env/static/private";
import { expandGeohashes, geohashesNearby } from "$lib/crossover/utils";
import { EquipmentSlots } from "$lib/crossover/world/compendium";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import type { GeohashLocationType } from "$lib/crossover/world/types";
import type { Search } from "redis-om";
import { Repository } from "redis-om";
import { LOOK_PAGE_SIZE } from "..";
import {
    ItemEntitySchema,
    MonsterEntitySchema,
    PlayerEntitySchema,
    WorldEntitySchema,
    type Item,
    type ItemEntity,
    type Monster,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
} from "./entities";

// Exports
export {
    dungeonEntrancesQuerySet,
    equipmentQuerySet,
    fetchEntity,
    getNearbyEntities,
    getNearbyPlayerIds,
    hasCollidersInGeohash,
    initializeClients,
    inventoryQuerySet,
    isGeohashInWorld,
    itemRepository,
    itemsInGeohashQuerySet,
    loggedInPlayersQuerySet,
    monsterRepository,
    monstersInGeohashQuerySet,
    playerRepository,
    playersInGeohashQuerySet,
    redisClient,
    redisSubscribeClient,
    saveEntity,
    worldRepository,
    worldsContainingGeohashQuerySet,
    worldsInGeohashQuerySet,
};

// Repositories
let playerRepository: Repository;
let monsterRepository: Repository;
let itemRepository: Repository;
let worldRepository: Repository;

// Create clients
const redisClient = createClient({
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
    socket: {
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT),
    },
});
const redisSubscribeClient = redisClient.duplicate();

async function initializeClients() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
        console.log("Connected to Redis[pub]");

        // Register Schemas
        registerSchemas();

        // Create Indexes
        createIndexes();
    }
    if (!redisSubscribeClient.isOpen) {
        await redisSubscribeClient.connect();
        console.log("Connected to Redis[sub]");
    }
}

function registerSchemas() {
    console.log("Registering redis schemas");
    playerRepository = new Repository(PlayerEntitySchema, redisClient);
    monsterRepository = new Repository(MonsterEntitySchema, redisClient);
    itemRepository = new Repository(ItemEntitySchema, redisClient);
    worldRepository = new Repository(WorldEntitySchema, redisClient);
}

function createIndexes() {
    console.log("Creating indexes for redis schemas");
    playerRepository.createIndex();
    monsterRepository.createIndex();
    itemRepository.createIndex();
    worldRepository.createIndex();
}

/*
 * Utilities
 */

async function fetchEntity(
    entity: string,
): Promise<PlayerEntity | MonsterEntity | ItemEntity | null> {
    if (entity.startsWith("monster")) {
        const monster = (await monsterRepository.fetch(
            entity,
        )) as MonsterEntity;
        if (monster.monster) return monster;
    } else if (entity.startsWith("item")) {
        const item = (await itemRepository.fetch(entity)) as ItemEntity;
        if (item.item) return item;
    } else {
        const player = (await playerRepository.fetch(entity)) as PlayerEntity;
        if (player.player) return player;
    }
    return null;
}

/**
 * Retrieves nearby entities based on the provided geohash and page size.
 *
 * @param geohash - The geohash used to determine nearby entities.
 * @param playersPageSize - The page size for retrieving players.
 * @returns A promise that resolves to an object containing players, monsters, and items.
 */
async function getNearbyEntities(
    geohash: string,
    locationType: GeohashLocationType,
    playersPageSize: number,
    options: {
        monsters: boolean;
        items: boolean;
        players: boolean;
    } = { monsters: true, items: true, players: true },
): Promise<{
    players: Player[];
    monsters: Monster[];
    items: Item[];
}> {
    // Get nearby geohashes
    const p6 = geohash.slice(0, -2);
    const nearbyGeohashes = geohashesNearby(p6);

    return {
        players: options.players
            ? ((await playersInGeohashQuerySet(
                  nearbyGeohashes,
                  locationType,
              ).return.all({
                  pageSize: playersPageSize,
              })) as PlayerEntity[])
            : [],
        monsters: options.monsters
            ? ((await monstersInGeohashQuerySet(
                  nearbyGeohashes, // no pageSize for monsters, retrive everything
                  locationType,
              ).return.all()) as MonsterEntity[])
            : [],
        items: options.items
            ? ((await itemsInGeohashQuerySet(
                  nearbyGeohashes, // no pageSize for monsters, retrive everything
                  locationType,
              ).return.all()) as ItemEntity[])
            : [],
    };
}

async function getNearbyPlayerIds(
    geohash: string,
    locationType: GeohashLocationType,
): Promise<string[]> {
    const { players } = await getNearbyEntities(
        geohash,
        locationType,
        LOOK_PAGE_SIZE,
        {
            players: true,
            monsters: false,
            items: false,
        },
    );
    return players.map((p) => p.player);
}

async function saveEntity(
    entity: PlayerEntity | MonsterEntity | ItemEntity,
): Promise<PlayerEntity | MonsterEntity | ItemEntity> {
    if (entity.player) {
        return (await playerRepository.save(
            (entity as PlayerEntity).player,
            entity,
        )) as PlayerEntity;
    } else if (entity.monster) {
        return (await monsterRepository.save(
            (entity as MonsterEntity).monster,
            entity,
        )) as MonsterEntity;
    } else if (entity.item) {
        return (await itemRepository.save(
            (entity as ItemEntity).item,
            entity,
        )) as ItemEntity;
    }

    throw new Error("Invalid entity");
}

async function hasCollidersInGeohash(
    geohash: string,
    locationType: GeohashLocationType,
): Promise<boolean> {
    return (
        (await itemsInGeohashQuerySet([geohash], locationType)
            .and("cld")
            .equal(true)
            .count()) > 0
    );
}

async function isGeohashInWorld(
    geohash: string,
    locationType: GeohashLocationType,
): Promise<boolean> {
    return (
        (await worldsContainingGeohashQuerySet(
            [geohash],
            locationType,
        ).count()) > 0
    );
}

/*
 * QuerySets
 */

/**
 * Returns a search query set for logged in players.
 * @returns A search query set for logged in players.
 */
function loggedInPlayersQuerySet(): Search {
    return playerRepository.search().where("lgn").equal(true);
}

/**
 * Returns a search query set for players in a specific geohash.
 * @param geohashes The geohashes to filter players by.
 * @returns A search query set for players in the specified geohash.
 */
function playersInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocationType,
): Search {
    return loggedInPlayersQuerySet()
        .and("locT")
        .equal(locationType)
        .and("loc")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Returns a search query set for monsters in a specific geohash.
 * @param geohashes The geohashes to filter monsters by.
 * @returns A search query set for monsters in the specified geohash.
 */
function monstersInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocationType,
): Search {
    return monsterRepository
        .search()
        .where("locT")
        .equal(locationType)
        .and("loc")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Retrieves items in a geohash query set.
 * @param geohashes - The geohashes to search for items in.
 * @returns A Search object representing the query.
 */
function itemsInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocationType,
): Search {
    return itemRepository
        .search()
        .where("locT")
        .equal(locationType)
        .and("loc")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Retrieves worlds if the geohash is inside the world
 * Note: This is not the same as `worldsInGeohashQuerySet` in which the world is inside the geohash
 * @param geohashes - The geohashes to search for worlds in.
 * @param precision - The precision level of the geohashes (defaults to town).
 * @returns A Search object representing the query.
 */
function worldsContainingGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocationType,
    precision?: number,
): Search {
    precision ??= worldSeed.spatial.town.precision;
    return worldRepository
        .search()
        .where("locT")
        .equal(locationType)
        .and("loc")
        .containOneOf(...expandGeohashes(geohashes, precision));
}

/**
 * Retrieves worlds in a geohash query set.
 * @param geohashes - The geohashes to search for worlds in.
 * @returns A Search object representing the query.
 */
function worldsInGeohashQuerySet(
    geohashes: string[],
    locationType: GeohashLocationType,
): Search {
    return worldRepository
        .search()
        .where("locT")
        .equal(locationType)
        .and("loc")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Retrieves the inventory items for a specific player.
 * @param player - The name of the player.
 * @returns A Search object representing the query for player inventory items.
 */
function inventoryQuerySet(player: string): Search {
    return itemRepository.search().where("loc").contains(player);
}

/**
 * Retrieves the equipped items for a specific player.
 * @param player - The name of the player.
 * @returns A Search object representing the query for player inventory items.
 */
function equipmentQuerySet(player: string): Search {
    return itemRepository
        .search()
        .where("locT")
        .containsOneOf(...EquipmentSlots)
        .where("loc")
        .contains(player);
}

function dungeonEntrancesQuerySet(
    territory: string,
    locationType: GeohashLocationType,
): Search {
    return itemRepository
        .search()
        .where("prop")
        .equal(compendium.dungeonentrance.prop)
        .and("locT")
        .equal(locationType)
        .and("loc")
        .containOneOf(`${territory}*`);
}
