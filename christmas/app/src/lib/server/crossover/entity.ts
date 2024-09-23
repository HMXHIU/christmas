import type { MonsterEntity, PlayerEntity } from "$lib/crossover/types";
import { entityCurrencyReward } from "$lib/crossover/world/entity";
import { saveEntity } from "./redis/utils";

export { awardKillCurrency };

async function awardKillCurrency(
    entity: PlayerEntity | MonsterEntity,
    killed: PlayerEntity | MonsterEntity,
    save: boolean = true,
): Promise<PlayerEntity | MonsterEntity> {
    const { lum, umb } = entityCurrencyReward(killed);
    entity.lum += lum;
    entity.umb += umb;
    if (save) {
        entity = await saveEntity(entity);
    }
    return entity;
}
