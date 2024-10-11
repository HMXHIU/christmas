import { hashObject } from "$lib/server";
import { type DialogueEntity } from "$lib/server/crossover/types";
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
    initializeCrossoverRedisRepositories,
    itemRepository,
    monsterRepository,
    playerRepository,
    questRepository,
    registerSchemas,
    worldRepository,
};

// Repositories
let playerRepository: Repository;
let monsterRepository: Repository;
let itemRepository: Repository;
let worldRepository: Repository;
let dialogueRepository: Repository;
let questRepository: Repository;

async function initializeCrossoverRedisRepositories(redisClient: any) {
    // Register Schemas
    registerSchemas(redisClient);

    // Create Indexes
    await createIndexes();

    // Index Dialogues
    await indexDialogues();
}

function registerSchemas(redisClient: any) {
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
