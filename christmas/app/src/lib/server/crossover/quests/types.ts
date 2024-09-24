import type { Entity } from "redis-om";

export type {
    DialogueEffect,
    DialogueTrigger,
    DropEffect,
    Effect,
    GiveTrigger,
    KillTrigger,
    Objective,
    Quest,
    QuestEntity,
    QuestTemplate,
    QuestWrit,
    Reward,
    Trigger,
};

// Note: the entities used in the quest include prop and beast

/**
 * Quest
 */

interface QuestTemplateEntity {
    type: "monster" | "beast" | "item" | "player" | "npc";
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

interface QuestTemplate {
    template: string;
    description: string;
    objectives: Objective[];
    entities: Record<
        string,
        QuestTemplateItem | QuestTemplateMonster | QuestTemplatePlayer
    >;
}

interface Quest {
    template: string;
    quest: string;
    description: string;
    objectives: Objective[];
    entities: Record<string, string>;
    reward: Reward;
    fulfilled: boolean;
}

type QuestEntity = Quest & Entity;

interface QuestWrit {
    quest: string;
    description: string; // from the `Quest`
    objectives: Omit<Objective, "trigger" | "effect">; // player should not get sensitive information about the quest
}

/**
 * Objective
 */

interface Objective {
    description: string;
    trigger: KillTrigger | GiveTrigger | DialogueTrigger;
    effect: DropEffect | DialogueEffect;
    fulfilled: boolean;
    reward?: Reward;
}

/**
 * Trigger
 */

type Triggers = "kill" | "give" | "dialogue";

interface Trigger {
    type: Triggers;
}

interface KillTrigger extends Trigger {
    type: "kill";
    entity: string;
}

interface GiveTrigger extends Trigger {
    type: "give";
    give: string;
    to: string;
}

interface DialogueTrigger extends Trigger {
    type: "dialogue";
    with: string;
    dialogue: string;
}

/**
 * Effect
 */

type Effects = "drop" | "dialogue";

interface Effect {
    type: Effects;
}

interface DropEffect extends Effect {
    type: "drop";
    item: string;
}

interface DialogueEffect extends Effect {
    type: "dialogue";
    dialogue: string;
}

/**
 * Reward
 */

interface Reward {
    lum?: number;
    umb?: number;
    items?: string[];
    props?: string[];
}
