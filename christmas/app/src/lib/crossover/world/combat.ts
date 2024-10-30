import type { DieRoll } from "../types";

export {
    conditions,
    ConditionsEnum,
    elementalDamageTypes,
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
    active: boolean;
    turns: number;
    dot?: DieRoll; // damage or heal over time
}

const conditions: Record<string, ConditionMetadata> = {
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
    },
    bleeding: {
        description: "bleeding",
        active: true,
        turns: 5,
        dot: {
            count: 2,
            sides: 4,
            damageType: "healing",
            modifiers: ["con"],
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
    },
    frozen: {
        description: "frozen",
        active: true,
        turns: 2,
        dot: {
            count: 1,
            sides: 4,
            damageType: "healing",
            modifiers: ["mnd"],
        },
    },
} as const;

type Condition = keyof typeof conditions;

const ConditionsEnum = Object.keys(conditions) as [Condition, ...Condition[]]; // for use with zod
