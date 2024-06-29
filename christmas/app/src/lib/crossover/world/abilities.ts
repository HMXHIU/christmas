import type {
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { substituteVariables } from "$lib/utils";
import lodash from "lodash";
import type { GameActionEntities, TokenPositions } from "../ir";
import { TICKS_PER_TURN } from "./settings";
const { cloneDeep } = lodash;

export {
    abilities,
    hasResourcesForAbility,
    patchEffectWithVariables,
    resolveAbilityEntities,
    type Abilities,
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
type Abilities =
    | "bandage"
    | "disintegrate"
    | "scratch"
    | "swing"
    | "doubleSlash"
    | "eyePoke"
    | "bite"
    | "breathFire"
    | "paralyze"
    | "blind"
    | "teleport";

interface Ability {
    ability: Abilities;
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
 * `abilities` is a collection of all the `Ability` available in the game.
 */
const abilities: Record<string, Ability> = {
    bandage: {
        ability: "bandage",
        type: "healing",
        description: "Bandages the player's wounds.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: -5, damageType: "healing" },
                    ticks: TICKS_PER_TURN,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 0,
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
    },
    disintegrate: {
        ability: "disintegrate",
        type: "offensive",
        description: "Disintegrates the target. [FOR TESTING ONLY]",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 100, damageType: "necrotic" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 1,
        st: 0,
        hp: 0,
        mp: 1,
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: false,
        },
    },
    scratch: {
        ability: "scratch",
        type: "offensive",
        description: "Scratches the target.",
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
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: false,
        },
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
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: false,
        },
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
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: false,
        },
    },
    // Blinded target cannot be affected by genjutsu
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
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
    },
    // TODO: Remove illusions (genjutsu) on target
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
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
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
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster", "item"],
            targetSelfAllowed: false,
        },
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
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
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
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
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
                        state: "loc",
                        value: "{{target.loc}}", // {{}} for variable access
                        op: "change",
                    },
                    ticks: TICKS_PER_TURN,
                },
            ],
        ],
        ap: 4,
        st: 0,
        hp: 0,
        mp: 20,
        range: -1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster", "item"],
            targetSelfAllowed: true,
        },
    },
};

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
    self: Player | Monster | Item;
    target: Player | Monster | Item;
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
    self: Player | Monster,
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
}): GameActionEntities[] {
    const {
        target: targetTypes,
        self: selfTypes,
        targetSelfAllowed,
    } = abilities[ability].predicate;

    // Check if self matches any allowed self type
    if (!selfTypes.some((type) => (self as any)[type] != null)) {
        return [];
    }

    let gameActionEntitiesScores: [GameActionEntities, number][] = [];

    const entities = { monster: monsters, player: players, item: items };
    const addedTargets: Record<string, boolean> = {};
    for (const type of targetTypes) {
        for (const entity of entities[type]) {
            const targetId = (entity as any)[type];
            const selfId = (self as any)[type];

            // Check if target is self if targetSelfAllowed is false
            if (!targetSelfAllowed && targetId === selfId) {
                continue;
            }

            // Check for identical targets (eg. self targeting abilities have both self and target in entities)
            if (addedTargets[targetId]) {
                continue;
            }
            gameActionEntitiesScores.push([
                { self, target: entity },
                highestScoreForToken(targetId, tokenPositions),
            ]);
            addedTargets[targetId] = true;
        }
    }

    // Sort by score
    return gameActionEntitiesScores
        .sort((a, b) => b[1] - a[1])
        .map((a) => a[0]);
}

function highestScoreForToken(
    entityId: string,
    tokenPositions: TokenPositions,
): number {
    let score = 0;
    if (tokenPositions[entityId] != null) {
        for (const tokenScore of Object.values(tokenPositions[entityId])) {
            if (tokenScore.score > score) {
                score = tokenScore.score;
            }
        }
    }
    return score;
}
