import {
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    REDIS_USERNAME,
} from "$env/static/private";
import { type DialogueEntity } from "$lib/crossover/types";
import { hashObject } from "$lib/server";
import { createClient } from "redis";
import { Repository } from "redis-om";
import { dialogues } from "../settings/npc";
import {
    DialogueSchema,
    ItemEntitySchema,
    MonsterEntitySchema,
    PlayerEntitySchema,
    QuestSchema,
    WorldEntitySchema,
} from "./schema";

// Exports
export {
    dialogueRepository,
    initializeClients,
    itemRepository,
    monsterRepository,
    playerRepository,
    questRepository,
    redisClient,
    redisSubscribeClient,
    worldRepository,
};

// Repositories
let playerRepository: Repository;
let monsterRepository: Repository;
let itemRepository: Repository;
let worldRepository: Repository;
let dialogueRepository: Repository;
let questRepository: Repository;

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
        console.info("Connected to Redis[pub]");

        // Register Schemas
        registerSchemas();

        // Create Indexes
        await createIndexes();

        // Index Dialogues
        await indexDialogues();
    }
    if (!redisSubscribeClient.isOpen) {
        await redisSubscribeClient.connect();
        console.info("Connected to Redis[sub]");
    }
}

function registerSchemas() {
    console.info("Registering redis schemas");
    playerRepository = new Repository(PlayerEntitySchema, redisClient);
    monsterRepository = new Repository(MonsterEntitySchema, redisClient);
    itemRepository = new Repository(ItemEntitySchema, redisClient);
    worldRepository = new Repository(WorldEntitySchema, redisClient);
    dialogueRepository = new Repository(DialogueSchema, redisClient);
    questRepository = new Repository(QuestSchema, redisClient);
}

async function createIndexes() {
    console.info("Creating indexes for redis schemas");
    await playerRepository.createIndex();
    await monsterRepository.createIndex();
    await itemRepository.createIndex();
    await worldRepository.createIndex();
    await dialogueRepository.createIndex();
    await questRepository.createIndex();
}

async function indexDialogues() {
    // TODO: - lock the redis table here (multiple servers might be indexing at the same time)
    //       - hash the dialogues table and store in redis (skip if the same)
    console.info("Re-Indexing all dialogues");
    for (const [_, ds] of Object.entries(dialogues)) {
        for (const d of ds) {
            const dialogueId = hashObject(d, "md5"); // md5 is shorter
            const dialogueEntity = (await dialogueRepository.fetch(
                dialogueId,
            )) as DialogueEntity;
            if (!dialogueEntity.dia) {
                await dialogueRepository.save(dialogueId, d as DialogueEntity);
            }
        }
    }
}
