import { createClient } from "redis";

import {
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    REDIS_USERNAME,
} from "$env/static/private";
import { Repository } from "redis-om";
import {
    ItemEntitySchema,
    MonsterEntitySchema,
    PlayerEntitySchema,
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "./entities";

// Exports
export {
    fetchEntity,
    initializeClients,
    isEntityBusy,
    itemRepository,
    monsterRepository,
    playerRepository,
    redisClient,
    redisSubscribeClient,
    saveEntity,
    setEnityBusy,
};

// Repositories
let playerRepository: Repository;
let monsterRepository: Repository;
let itemRepository: Repository;

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
}

function createIndexes() {
    console.log("Creating indexes for redis schemas");
    playerRepository.createIndex();
    monsterRepository.createIndex();
    itemRepository.createIndex();
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

async function setEnityBusy(entity: string, ms: number) {
    await redisClient.set(`${entity}:busy`, "true", {
        PX: ms,
    });
}

async function isEntityBusy(entity: string): Promise<boolean> {
    return (await redisClient.get(`${entity}:busy`)) === "true";
}
