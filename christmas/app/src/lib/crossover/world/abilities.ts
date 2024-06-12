import type {
    EntityType,
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { substituteVariables } from "$lib/utils";
import lodash from "lodash";
import { geohashToGridCell } from ".";
import type { GameActionEntities, TokenPositions } from "../ir";
import { abilities } from "./settings";
const { cloneDeep } = lodash;

export {
    checkInRange,
    hasResourcesForAbility,
    patchEffectWithVariables,
    resolveAbilityEntities,
    type Ability,
    type AbilityType,
    type Attributes,
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

interface Attributes {
    dex: number;
    str: number;
    int: number;
    con: number;
    wis: number;
    cha: number;
}

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
    predicate: {
        self: EntityType[];
        target: EntityType[];
        targetSelfAllowed: boolean;
    };
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
        state: "loc" | "ap" | "hp" | "mp" | "st";
        op: "change" | "subtract" | "add";
        value: number | string | boolean | string[];
    };
}

/**
 * Patch the effect using `self` and `target` variables.
 *
 * @param params.effect - The effect object to be modified.
 * @param params.self - The entity representing the source of the effect.
 * @param params.target - The entity representing the target of the effect.
 * @returns  The modified effect object with filled in variables.
 */
function patchEffectWithVariables({
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
        // Location requires variable access eg. {{target.loc}}
        if (effectClone.states.state === "loc") {
            if (!Array.isArray(value)) {
                throw new Error("Variable is not a loc string[]");
            }
            effectClone.states.value = value;
        } else {
            if (typeof value !== "string") {
                throw new Error("Variable is not a string");
            }
            effectClone.states.value = parseInt(value);
        }
    }

    return effectClone;
}

function hasResourcesForAbility(
    self: PlayerEntity | MonsterEntity,
    ability: string,
): { hasResources: boolean; message: string } {
    const { ap, mp, st, hp } = abilities[ability];

    if (self.ap < ap) {
        return {
            hasResources: false,
            message: `Not enough action points to ${ability}.`,
        };
    } else if (self.hp < hp) {
        return {
            hasResources: false,
            message: `Not enough health points to ${ability}.`,
        };
    } else if (self.mp < mp) {
        return {
            hasResources: false,
            message: `Not enough mana points to ${ability}.`,
        };
    } else if (self.st < st) {
        return {
            hasResources: false,
            message: `Not enough stamina points to ${ability}.`,
        };
    }

    return {
        hasResources: true,
        message: "",
    };
}

function checkInRange(
    self: PlayerEntity | MonsterEntity,
    target: PlayerEntity | MonsterEntity | ItemEntity,
    range: number,
): boolean {
    // Use only the first geohash in the location
    const { row: r1, col: c1 } = geohashToGridCell(self.loc[0]);
    const { row: r2, col: c2 } = geohashToGridCell(target.loc[0]);
    const inRange =
        range < 0 ||
        Math.ceil(Math.sqrt((r1 - r2) ** 2 + (c1 - c2) ** 2)) <= range;
    return inRange;
}

/**
 * Resolves the ability entities based on the provided parameters.
 *
 * @param queryTokens - The query tokens.
 * @param ability - The ability.
 * @param self - The self entity.
 * @param monsters - The monster entities.
 * @param players - The player entities.
 * @param items - The item entities.
 * @returns - The resolved ability entities, or null if no entities are found.
 */
function resolveAbilityEntities({
    queryTokens,
    tokenPositions,
    ability,
    self,
    monsters,
    players,
    items,
}: {
    queryTokens: string[];
    tokenPositions: TokenPositions;
    ability: string;
    self: Player | Monster;
    monsters: Monster[];
    players: Player[];
    items: Item[];
}): null | GameActionEntities {
    const {
        target: targetTypes,
        self: selfTypes,
        targetSelfAllowed,
    } = abilities[ability].predicate;

    // Check self types (e.g. player, monster, item in self)
    if (!selfTypes.some((type) => ((self as any)[type] as string) != null)) {
        return null;
    }

    // Find target type in monsters
    if (targetTypes.includes("monster")) {
        for (const m of monsters) {
            if (!targetSelfAllowed && m.monster === (self as any).monster) {
                continue;
            }
            return { self, target: m }; // early return
        }
    }

    // Find target type in players
    if (targetTypes.includes("player")) {
        for (const p of players) {
            if (!targetSelfAllowed && p.player === (self as any).player) {
                continue;
            }
            return { self, target: p }; // early return
        }
    }

    // Find target type in items
    if (targetTypes.includes("item")) {
        for (const i of items) {
            if (!targetSelfAllowed && i.item === (self as any).item) {
                continue;
            }
            return { self, target: i }; // early return
        }
    }

    return null;
}
