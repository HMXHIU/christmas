import {
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "$lib/crossover/types";
import {
    itemRepository,
    monsterRepository,
    playerRepository,
    questRepository,
} from ".";
import type { QuestEntity } from "../quests/types";

export { fetchEntity, fetchQuest, saveEntities, saveEntity };

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

async function fetchQuest(entity: string): Promise<QuestEntity | null> {
    const quest = (await questRepository.fetch(entity)) as QuestEntity;
    if (quest.quest) return quest;
    return null;
}

async function saveEntity<
    T extends PlayerEntity | MonsterEntity | ItemEntity | QuestEntity,
>(entity: T): Promise<T> {
    if (entity.player) {
        return (await playerRepository.save(
            (entity as PlayerEntity).player,
            entity,
        )) as T;
    } else if (entity.monster) {
        return (await monsterRepository.save(
            (entity as MonsterEntity).monster,
            entity,
        )) as T;
    } else if (entity.item) {
        return (await itemRepository.save(
            (entity as ItemEntity).item,
            entity,
        )) as T;
    } else if (entity.quest) {
        return (await questRepository.save(
            (entity as QuestEntity).quest,
            entity,
        )) as T;
    }
    throw new Error("Invalid entity");
}

async function saveEntities(
    ...entities: (PlayerEntity | MonsterEntity | ItemEntity | QuestEntity)[]
) {
    for (const e of entities) {
        await saveEntity(e);
    }
}