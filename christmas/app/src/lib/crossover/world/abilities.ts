import type {
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { substituteVariables } from "$lib/utils";
import lodash from "lodash";
import { TICKS_PER_TURN, geohashToCell } from ".";
const { cloneDeep } = lodash;

export {
    abilities,
    canPerformAbility,
    checkInRange,
    fillInEffectVariables,
    type Ability,
    type AbilityType,
    type AfterProcedures,
    type BeforeProcedures,
    type Buff,
    type DamageType,
    type Debuff,
    type OnProcedure,
    type Procedure,
    type ProcedureEffect,
};

type AbilityType = "offensive" | "defensive" | "healing" | "neutral"; // to allow AI to choose abilities based on the situation
type DamageType =
    | "slashing"
    | "blunt"
    | "piercing"
    | "fire"
    | "ice"
    | "lightning"
    | "poison"
    | "necrotic"
    | "radiant"
    | "healing";
type Debuff =
    | "paralyzed"
    | "blinded"
    | "wet"
    | "burning"
    | "poisoned"
    | "frozen"
    | "bleeding"
    | "stunned"
    | "confused"
    | "charmed"
    | "frightened"
    | "exhausted"
    | "silenced"
    | "diseased";
type Buff = "haste" | "regeneration" | "shield" | "invisibility" | "berserk";

type State = "location" | "ap" | "hp" | "mp" | "st";

interface Ability {
    ability: string;
    type: AbilityType;
    description: string;
    procedures: Procedure[];
    ap: number; // AP cost of the ability
    hp: number; // HP cost of the ability
    mp: number; // MP cost of the ability
    st: number; // ST cost of the ability
    range: number; // range of the ability (number of unit precision geohashes)
    aoe: number; // area of effect (number of unit precision geohashes)
}

type Procedure = ["action" | "check", ProcedureEffect];
interface ProcedureEffect {
    target: "self" | "target";
    ticks: number;
    damage?: {
        amount: number;
        damageType: DamageType;
    };
    debuffs?: {
        debuff: Debuff;
        op: "push" | "pop" | "contains" | "doesNotContain";
    };
    buffs?: {
        buff: Buff;
        op: "push" | "pop" | "contains" | "doesNotContain";
    };
    states?: {
        state: State;
        op: "change" | "subtract" | "add";
        value: number | string | boolean | string[];
    };
}

const abilities: Record<string, Ability> = {
    bandage: {
        ability: "bandage",
        type: "healing",
        description: "Bandages the player's wounds.",
        procedures: [
            [
                "action",
                {
                    target: "self",
                    damage: { amount: -5, damageType: "healing" },
                    ticks: TICKS_PER_TURN,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 0,
        range: 0,
        aoe: 0,
    },
    scratch: {
        ability: "scratch",
        type: "offensive",
        description: "Scratches the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "slashing" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 1,
        st: 1,
        hp: 0,
        mp: 0,
        range: 0,
        aoe: 0,
    },
    swing: {
        ability: "swing",
        type: "offensive",
        description: "Swing at the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "blunt" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 1,
        st: 1,
        hp: 0,
        mp: 0,
        range: 0,
        aoe: 0,
    },
    doubleSlash: {
        ability: "doubleSlash",
        type: "offensive",
        description: "Slashes the player twice.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "slashing" },
                    ticks: TICKS_PER_TURN / 3,
                },
            ],
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "slashing" },
                    ticks: TICKS_PER_TURN / 3,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 0,
        range: 0,
        aoe: 0,
    },
    eyePoke: {
        ability: "eyePoke",
        type: "offensive",
        description: "Pokes the player's eyes, blinding them.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    debuffs: { debuff: "blinded", op: "push" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
            [
                "check",
                {
                    target: "target",
                    debuffs: { debuff: "blinded", op: "contains" },
                    ticks: 0,
                },
            ],
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "piercing" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 2,
        st: 2,
        hp: 0,
        mp: 0,
        range: 0,
        aoe: 0,
    },
    bite: {
        ability: "bite",
        type: "offensive",
        description: "Bites the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "piercing" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 1,
        st: 1,
        hp: 0,
        mp: 0,
        range: 1,
        aoe: 0,
    },
    breathFire: {
        ability: "breathFire",
        type: "offensive",
        description: "Breathes fire possibly burning the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 3, damageType: "fire" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
            [
                "check",
                {
                    target: "target",
                    debuffs: { debuff: "wet", op: "doesNotContain" },
                    ticks: 0,
                },
            ],
            [
                "action",
                {
                    target: "target",
                    debuffs: { debuff: "burning", op: "push" },
                    ticks: 0,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 2,
        range: 1,
        aoe: 1,
    },
    paralyze: {
        ability: "paralyze",
        type: "offensive",
        description: "Paralyzes the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    debuffs: { debuff: "paralyzed", op: "push" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 2,
        range: 0,
        aoe: 0,
    },
    blind: {
        ability: "blind",
        type: "offensive",
        description: "Blinds the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    debuffs: { debuff: "blinded", op: "push" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 2,
        range: 0,
        aoe: 0,
    },
    teleport: {
        ability: "teleport",
        type: "neutral",
        description: "Teleport to the target location.",
        procedures: [
            [
                "action",
                {
                    target: "self",
                    states: {
                        state: "location",
                        value: "{{target.location}}", // {{}} for variable access
                        op: "change",
                    },
                    ticks: TICKS_PER_TURN,
                },
            ],
        ],
        ap: 10,
        st: 0,
        hp: 0,
        mp: 20,
        range: -1,
        aoe: 0,
    },
};

type OnProcedure = ({
    target,
    effect,
}: {
    target: PlayerEntity | MonsterEntity | ItemEntity;
    effect: ProcedureEffect;
}) => Promise<void>;

type BeforeProcedures = ({
    self,
    target,
    ability,
}: {
    self: PlayerEntity | MonsterEntity | ItemEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity;
    ability: string;
}) => Promise<void>;

type AfterProcedures = ({
    self,
    target,
    ability,
}: {
    self: PlayerEntity | MonsterEntity | ItemEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity;
    ability: string;
}) => Promise<void>;

/**
 * Fills in effect variables in the given `effect` object using the `self` and `target` entities.
 *
 * @param params.effect - The effect object to be modified.
 * @param params.self - The entity representing the source of the effect.
 * @param params.target - The entity representing the target of the effect.
 * @returns  The modified effect object with filled in variables.
 */
function fillInEffectVariables({
    effect,
    self,
    target,
}: {
    effect: ProcedureEffect;
    self: PlayerEntity | MonsterEntity | ItemEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity;
}): ProcedureEffect {
    const effectClone = cloneDeep(effect); // don't modify the template

    // Damage
    if (typeof effectClone.damage?.amount === "string") {
        const value = substituteVariables(effectClone.damage.amount, {
            self,
            target,
        });

        // Check that value is a string else throw error
        if (typeof value !== "string") {
            throw new Error("Variable is not a string");
        }

        effectClone.damage.amount = parseInt(value);
    }

    // States
    if (typeof effectClone.states?.value === "string") {
        const value = substituteVariables(effectClone.states.value, {
            self,
            target,
        });
        if (effectClone.states.state === "location") {
            // Check that value is a location (string[])
            if (!Array.isArray(value)) {
                throw new Error("Variable is not a location string[]");
            }

            effectClone.states.value = value;
        } else {
            // Check that value is a string else throw error
            if (typeof value !== "string") {
                throw new Error("Variable is not a string");
            }
            effectClone.states.value = parseInt(value);
        }
    }

    return effectClone;
}

function canPerformAbility(
    self: PlayerEntity | MonsterEntity,
    ability: string,
): boolean {
    const { ap, mp, st, hp } = abilities[ability];
    return self.ap >= ap && self.mp >= mp && self.st >= st && self.hp >= hp;
}

function checkInRange(
    self: PlayerEntity | MonsterEntity,
    target: PlayerEntity | MonsterEntity | ItemEntity,
    range: number,
): boolean {
    // Use only the first geohash in the location
    const { row: r1, col: c1 } = geohashToCell(self.location[0]);
    const { row: r2, col: c2 } = geohashToCell(target.location[0]);
    const inRange =
        range < 0 ||
        Math.ceil(Math.sqrt((r1 - r2) ** 2 + (c1 - c2) ** 2)) <= range;
    return inRange;
}
