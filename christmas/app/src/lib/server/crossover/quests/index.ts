import type { ItemEntity } from "$lib/crossover/types";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    generateRandomSeed,
    sampleFrom,
    substituteVariables,
    substituteVariablesRecursively,
} from "$lib/utils";
import { spawnQuestItem } from "../dungeonMaster";
import { questRepository } from "../redis";
import { npcs } from "../settings/npc";
import { random } from "../utils";
import type { QuestEntity, QuestTemplate } from "./types";

export { createQuest, createQuestWrit };

async function createQuest(template: QuestTemplate): Promise<QuestEntity> {
    const entities: Record<string, string> = {};
    const questId = `${template.template}-${await questRepository.search().count()}`;

    // TODO: generate the following using PG or LLM
    const beasts = ["goblin", "giantSpider"];
    const reward = {
        lum: 10,
        umb: 10,
    };
    const npcKeys = Object.keys(npcs);

    // Determine entities
    for (const [templateString, templateEntity] of Object.entries(
        template.entities,
    )) {
        // Determine Beast
        if (templateEntity.type === "beast") {
            entities[templateString] = sampleFrom(
                beasts,
                1,
                generateRandomSeed(random()), // use random() for reproducibility in test environment
            )[0];
        }
        // Determine NPC
        else if (templateEntity.type === "npc") {
            entities[templateString] = sampleFrom(
                npcKeys,
                1,
                generateRandomSeed(random()),
            )[0];
        }
        // Determine Item
        else if (templateEntity.type === "item") {
            // Quest items are spawned at loc=[quest] locT="quest"
            const questItem = await spawnQuestItem({
                quest: questId,
                prop: templateEntity.prop,
                variables: templateEntity.variables,
            });
            entities[templateString] = questItem.item;
        }
    }

    const quest: QuestEntity = {
        quest: questId,
        template: template.template,
        description: substituteVariables(template.description, entities),
        objectives: substituteVariablesRecursively(
            template.objectives,
            entities,
        ),
        entities,
        reward,
        fulfilled: false,
    };

    return (await questRepository.save(questId, quest)) as QuestEntity;
}

async function createQuestWrit(quest: QuestEntity): Promise<ItemEntity> {
    // The initial loc=[quest] locT="quest"
    return (await spawnQuestItem({
        quest: quest.quest,
        prop: compendium.questwrit.prop,
        variables: {
            desription: quest.description,
        },
    })) as ItemEntity;
}
