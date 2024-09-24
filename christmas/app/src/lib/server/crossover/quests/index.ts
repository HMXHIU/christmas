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

export { createQuest };

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
                generateRandomSeed(random()), // use randon() for reproducibility in test environment
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
            const questItem = await spawnQuestItem({
                quest: `${template.template}-${questId}`,
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
    };

    return (await questRepository.save(questId, quest)) as QuestEntity;
}
