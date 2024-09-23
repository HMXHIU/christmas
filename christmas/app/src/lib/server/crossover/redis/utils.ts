import {
    type ItemEntity,
    type MonsterEntity,
    type PlayerEntity,
} from "$lib/crossover/types";
import { itemRepository, monsterRepository, playerRepository } from ".";

export { fetchEntity, saveEntities, saveEntity };

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

async function saveEntity<T extends PlayerEntity | MonsterEntity | ItemEntity>(
    entity: T,
): Promise<T> {
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
    }
    throw new Error("Invalid entity");
}

async function saveEntities(
    ...entities: (PlayerEntity | MonsterEntity | ItemEntity)[]
) {
    for (const e of entities) {
        await saveEntity(e);
    }
}
