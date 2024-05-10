import { createClient } from "redis";

import {
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    REDIS_USERNAME,
} from "$env/static/private";
import type { Search } from "redis-om";
import { Repository } from "redis-om";
import {
    ItemEntitySchema,
    MonsterEntitySchema,
    PlayerEntitySchema,
    WorldEntitySchema,
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "./entities";

// Exports
export {
    collidersInGeohashQuerySet,
    crossoverPlayerInventoryQuerySet,
    fetchEntity,
    initializeClients,
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

/**
 * Returns a search query set for logged in players.
 * @returns A search query set for logged in players.
 */
function loggedInPlayersQuerySet(): Search {
    return playerRepository.search().where("loggedIn").equal(true);
}

/**
 * Returns a search query set for players in a specific geohash.
 * @param geohashes The geohashes to filter players by.
 * @returns A search query set for players in the specified geohash.
 */
function playersInGeohashQuerySet(geohashes: string[]): Search {
    return loggedInPlayersQuerySet()
        .where("locT")
        .equal("geohash")
        .and("location")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Returns a search query set for monsters in a specific geohash.
 * @param geohashes The geohashes to filter monsters by.
 * @returns A search query set for monsters in the specified geohash.
 */
function monstersInGeohashQuerySet(geohashes: string[]): Search {
    return monsterRepository
        .search()
        .where("locT")
        .equal("geohash")
        .and("location")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Retrieves items in a geohash query set.
 * @param geohashes - The geohashes to search for items in.
 * @returns A Search object representing the query.
 */
function itemsInGeohashQuerySet(geohashes: string[]): Search {
    return itemRepository
        .search()
        .where("locT")
        .equal("geohash")
        .and("location")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Retrieves worlds in a geohash query set.
 * @param geohashes - The geohashes to search for worlds in.
 * @returns A Search object representing the query.
 */
function worldsInGeohashQuerySet(geohashes: string[]): Search {
    return worldRepository
        .search()
        .where("loc")
        .containOneOf(...geohashes.map((x) => `${x}*`));
}

/**
 * Retrieves the inventory items for a specific player.
 * @param player - The name of the player.
 * @returns A Search object representing the query for player inventory items.
 */
function crossoverPlayerInventoryQuerySet(player: string): Search {
    return itemRepository.search().where("location").contains(player);
}

/**
 * Retrieves a search query for finding colliders in a geohash.
 * @param geohash - The geohash to search for colliders in.
 * @returns A search query for finding colliders in the specified geohash.
 */
function collidersInGeohashQuerySet(geohash: string): Search {
    return itemsInGeohashQuerySet([geohash]).and("collider").equal(true);
}
