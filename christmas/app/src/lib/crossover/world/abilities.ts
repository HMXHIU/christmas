import type {
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { substituteVariables } from "$lib/utils";
import lodash from "lodash";
import { geohashToGridCell } from ".";
import { abilities } from "./settings";
const { cloneDeep } = lodash;

export {
    canPerformAbility,
    checkInRange,
    fillInEffectVariables,
    type Ability,
    type AbilityType,
    type Buff,
    type DamageType,
    type Debuff,
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

// /**
//  *
//  */
// interface AbilityTrigger {
//     trigger: string; // "${ability} ${target}"
//     variables: Record<string, string>;
// }
// interface AbilityTriggerVariable {
//     [variable: string]: {
//         type: EntityType;
//     }
// }

// const x = {
//     dialogues: ["${ability} ${target}"],
//     variables: {
//         "target" : {
//             entityTypes: ["player", "monster", "item"],
//         }
//     }
// }

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
    // trigger: AbilityTrigger
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
        state: "location" | "ap" | "hp" | "mp" | "st";
        op: "change" | "subtract" | "add";
        value: number | string | boolean | string[];
    };
}

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
    const { row: r1, col: c1 } = geohashToGridCell(self.location[0]);
    const { row: r2, col: c2 } = geohashToGridCell(target.location[0]);
    const inRange =
        range < 0 ||
        Math.ceil(Math.sqrt((r1 - r2) ** 2 + (c1 - c2) ** 2)) <= range;
    return inRange;
}
