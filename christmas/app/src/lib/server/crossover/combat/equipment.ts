import { compendium } from "$lib/crossover/world/settings/compendium";
import { equipmentQuerySet } from "../redis/queries";
import { saveEntity } from "../redis/utils";
import type { ItemEntity, PlayerEntity } from "../types";

export { resolveEquipment };

async function resolveEquipment(player: PlayerEntity): Promise<PlayerEntity> {
    const equipment = (await equipmentQuerySet(
        player.player,
    ).returnAll()) as ItemEntity[];

    // Apply weight (affects movement)
    player.wgt = equipment.reduce(
        (acc, eq) => acc + compendium[eq.prop].weight,
        0,
    );

    // Apply conditions (buffs/debuffs)

    // Apply set bonuses

    return saveEntity(player);
}
