import {
    type ActorEntity,
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { uniq } from "lodash-es";
import type { Repository } from "redis-om";
import {
    itemRepository,
    monsterRepository,
    playerRepository,
    questRepository,
} from ".";
import type { QuestEntity } from "../quests/types";

export { fetchEntity, fetchQuest, getOrCreateEntity, saveEntities, saveEntity };

async function fetchEntity(entity: string): Promise<ActorEntity | null> {
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

async function fetchQuest(questId: string): Promise<QuestEntity | null> {
    const quest = (await questRepository.fetch(questId)) as QuestEntity;
    if (quest.quest) return quest;
    return null;
}

async function saveEntity<T extends ActorEntity | QuestEntity>(
    entity: T,
): Promise<T> {
    if (entity.player) {
        await playerRepository.save((entity as PlayerEntity).player, entity);
    } else if (entity.monster) {
        await monsterRepository.save((entity as MonsterEntity).monster, entity);
    } else if (entity.item) {
        await itemRepository.save((entity as ItemEntity).item, entity);
    } else if (entity.quest) {
        await questRepository.save((entity as QuestEntity).quest, entity);
    } else {
        throw new Error("Invalid entity");
    }
    // Make sure to return the same reference object
    return entity;
}

async function saveEntities(...entities: (ActorEntity | QuestEntity)[]) {
    for (const e of uniq(entities)) {
        await saveEntity(e);
    }
}

async function getOrCreateEntity<T>(
    id: string,
    idKey: string,
    data: T,
    repository: Repository<Record<string, any>>,
): Promise<T> {
    const entity = await repository.fetch(id);
    // Note: redis will return empty entity which is not null, need to check a known key
    if (entity[idKey]) {
        return entity as T;
    } else {
        return (await repository.save(id, data as Record<string, any>)) as T;
    }
}
