import type { DieRoll } from "../types";

export {
    conditions,
    ConditionsEnum,
    elementalDamageTypes,
    expireConditions,
    physicalDamageTypes,
    type Condition,
    type DamageType,
};

/*
 * Damage Types
 */

const physicalDamageTypes = new Set(["slashing", "blunt", "piercing"]);
const elementalDamageTypes = new Set(["fire", "ice", "lightning", "water"]);

type DamageType =
    | "normal"
    // Physical
    | "slashing"
    | "blunt"
    | "piercing"
    // Elemental
    | "fire"
    | "ice"
    | "lightning"
    | "water"
    // Divine
    | "necrotic"
    | "radiant"
    // Others
    | "poison"
    | "healing";

/*
 * Conditions
 */

interface ConditionMetadata {
    description: string;
    dialogue?: {
        added: string;
        removed: string;
    };
    active: boolean;
    turns: number;
    dot?: DieRoll; // damage or heal over time
}

type Condition =
    | "haste"
    | "shield"
    | "berserk"
    | "regeneration"
    | "weakness"
    | "crippled"
    | "paralyzed"
    | "blinded"
    | "wet"
    | "stunned"
    | "confused"
    | "charmed"
    | "frightened"
    | "exhausted"
    | "silenced"
    | "diseased"
    | "poisoned"
    | "bleeding"
    | "burning"
    | "frozen";

const conditions: Record<Condition, ConditionMetadata> = {
    // Buffs (passive)
    haste: { description: "haste", active: false, turns: 2 },
    shield: { description: "shield", active: false, turns: 2 },
    berserk: { description: "berserk", active: false, turns: 2 },
    // Buffs (active)
    regeneration: {
        description: "regeneration",
        active: true,
        turns: 4,
        dot: {
            count: 1,
            sides: -6,
            damageType: "healing",
            modifiers: ["fth"],
        },
        dialogue: {
            added: "Healing energy surges through ${subject} as ${pronoun.possessive} wounds begin to close.",
            removed:
                "The regenerative energy fades from ${subject}, leaving ${pronoun.subject} restored",
        },
    },
    // Debuffs (passive)
    weakness: { description: "weakness", active: false, turns: 2 },
    crippled: { description: "crippled", active: false, turns: 2 },
    paralyzed: { description: "paralyzed", active: false, turns: 2 },
    blinded: { description: "blinded", active: false, turns: 2 },
    wet: { description: "wet", active: false, turns: 2 },
    stunned: { description: "stunned", active: false, turns: 2 },
    confused: { description: "confused", active: false, turns: 2 },
    charmed: { description: "charmed", active: false, turns: 2 },
    frightened: { description: "frightened", active: false, turns: 2 },
    exhausted: { description: "exhausted", active: false, turns: 2 },
    silenced: { description: "silenced", active: false, turns: 2 },
    // Debuffs (active)
    diseased: {
        description: "diseased",
        active: true,
        turns: 20,
        dot: {
            count: 1,
            sides: 4,
            damageType: "necrotic",
            modifiers: ["con"],
        },
        dialogue: {
            added: "A sickly pallor spreads across ${subject} as disease takes hold.",
            removed: "The disease finally releases its grip on ${subject}.",
        },
    },
    poisoned: {
        description: "poisoned",
        active: true,
        turns: 10,
        dot: {
            count: 1,
            sides: 6,
            damageType: "poison",
            modifiers: ["con"],
        },
        dialogue: {
            added: "Venom courses through ${pronoun.possessive} veins as ${subject} ${verb.be} poisoned.",
            removed: "The poison subsides, leaving ${subject} pale and shaken.",
        },
    },
    bleeding: {
        description: "bleeding",
        active: true,
        turns: 5,
        dot: {
            count: 2,
            sides: 4,
            damageType: "normal",
            modifiers: ["con"],
        },
        dialogue: {
            added: "Blood streams from ${subject} wounds as ${pronoun.object} begins bleeding profusely.",
            removed:
                "The bleeding finally stops, leaving ${subject} covered in dried blood.",
        },
    },
    burning: {
        description: "burning",
        active: true,
        turns: 3,
        dot: {
            count: 2,
            sides: 8,
            damageType: "fire",
            modifiers: ["cha"],
        },
        dialogue: {
            added: "${subject} ${verb.be} engulfed in searing flames.",
            removed:
                "${subject} ${verb.be} no longer burning, though smoke still wisps from ${pronoun.possessive} charred skin.",
        },
    },
    frozen: {
        description: "frozen",
        active: true,
        turns: 2,
        dot: {
            count: 1,
            sides: 4,
            damageType: "ice",
            modifiers: ["mnd"],
        },
        dialogue: {
            added: "A layer of crackling ice encases ${subject}, freezing ${pronoun.subject} in place.",
            removed:
                "The ice encasing ${subject} shatters, leaving ${pronoun.subject} shivering.",
        },
    },
} as const;

const ConditionsEnum = Object.keys(conditions) as [Condition, ...Condition[]]; // for use with zod

function expireConditions(conds: string[], now?: number): string[] {
    now = now ?? Date.now();
    return conds.filter((s) => {
        const [active, cond, end] = s.split(":");
        return Number(end) > now;
    });
}
