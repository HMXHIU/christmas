import { entityCurrencyReward } from "$lib/crossover/world/entity";
import type { CreatureEntity } from "$lib/server/crossover/types";
import { saveEntity } from "./redis/utils";

export { awardKillCurrency };

async function awardKillCurrency(
    entity: CreatureEntity,
    killed: CreatureEntity,
    save: boolean = true,
): Promise<CreatureEntity> {
    const { lum, umb } = entityCurrencyReward(killed);
    entity.lum += lum;
    entity.umb += umb;
    if (save) {
        entity = await saveEntity(entity);
    }
    return entity;
}
