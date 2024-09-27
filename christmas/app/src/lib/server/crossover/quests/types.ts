import type { Objective, Quest } from "$lib/crossover/types";
import type { Entity } from "redis-om";

export type { QuestEntity, QuestTemplate };

/**
 * Quest
 *
 * Note: the entities used in the quest include prop and beast
 */

type QuestEntity = Quest & Entity;

interface QuestTemplateEntity {
    type: "monster" | "beast" | "item" | "player" | "npc" | "trophy";
}

interface QuestTemplateItem extends QuestTemplateEntity {
    type: "item";
    prop: string;
    variables?: Record<string, any>;
}

interface QuestTemplateMonster extends QuestTemplateEntity {
    type: "monster" | "beast";
}

interface QuestTemplatePlayer extends QuestTemplateEntity {
    type: "npc" | "player";
}

interface QuestTemplateTrophy extends QuestTemplateEntity {
    type: "trophy";
    beast: string;
    npc: string;
}

interface QuestTemplate {
    template: string;
    name: string;
    description: string;
    objectives: Objective[];
    entities: Record<
        string,
        | QuestTemplateItem
        | QuestTemplateMonster
        | QuestTemplatePlayer
        | QuestTemplateTrophy
    >;
}
