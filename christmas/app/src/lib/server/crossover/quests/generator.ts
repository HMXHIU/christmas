import type { ItemEntity, PlayerEntity } from "$lib/crossover/types";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { generateRandomSeed, sampleFrom } from "$lib/utils";
import { createQuest, createQuestWrit } from ".";
import type { NPCs } from "../npc/types";
import { npcsNotInLimboQuerySet, questWritsQuerySet } from "../redis/queries";
import { saveEntity } from "../redis/utils";
import { killAndDeliverQuest } from "../settings/quests";
import { random } from "../utils";

export { generateInnKeeperQuests };

/**
 * Inn Keeper Quests
 * - Typically do not involve specific entity instances.
 * - Respawns with a high frequency, or when innkeeper runs out of quests
 */
async function generateInnKeeperQuests(innKeeper?: PlayerEntity) {
    // Generate for all inn keepers if specific inn keeper is not provided
    const innKeepers = innKeeper
        ? [innKeeper]
        : ((await npcsNotInLimboQuerySet(
              "innkeeper",
          ).returnAll()) as PlayerEntity[]);

    // Generate `killAndDeliverQuest` quests
    const deliverTo: NPCs[] = ["alchemist", "blacksmith", "grocer"];
    const beasts = ["goblin"]; // TODO: get beasts around area
    const reward = { lum: 10 }; // TODO: determine based in difficulty
    for (const innKeeper of innKeepers) {
        const numQuests = await questWritsQuerySet(innKeeper.player).count();

        if (numQuests < deliverTo.length) {
            const sampleDeliverTo = sampleFrom(
                deliverTo,
                deliverTo.length - numQuests,
                generateRandomSeed(random()),
            );

            for (const npc of sampleDeliverTo) {
                // Create quest & writ
                const quest = await createQuest(killAndDeliverQuest, {
                    beasts,
                    npcs: [npc],
                    reward,
                });
                let writ = (await createQuestWrit(quest)) as ItemEntity;
                // Give writ to npc
                writ.loc = [innKeeper.player];
                writ.locI = LOCATION_INSTANCE;
                writ.locT = "inv";
                writ = await saveEntity(writ);
            }
        }
    }
}
