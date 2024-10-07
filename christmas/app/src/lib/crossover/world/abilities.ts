import type {
    Actor,
    Creature,
    Currency,
    CurrencyParams,
    DieRoll,
    EntityStats,
    EntityType,
    Item,
    Monster,
    Player,
    Stat,
} from "$lib/crossover/types";
import { substituteVariables } from "$lib/utils";
import { cloneDeep } from "lodash-es";
import type { GameActionEntities, TokenPositions } from "../ir";
import { describeResource, type Attribute } from "./entity";
import { abilities } from "./settings/abilities";

export {
    AbilitiesEnum,
    getPlayerAbilities,
    hasResourcesForAbility,
    patchEffectWithVariables,
    resolveAbilityEntities,
    type Abilities,
    type Ability,
    type AbilityType,
    type Buff,
    type DamageType,
    type Debuff,
    type Procedure,
    type ProcedureEffect,
    type ProcedureStateEffects,
};

type AbilityType = "offensive" | "defensive" | "healing" | "neutral"; // to allow AI to choose abilities based on the situation
type DamageType =
    | "normal"
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
    | "weakness"
    | "crippled"
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

type Abilities =
    | "bandage"
    | "disintegrate"
    | "bruise"
    | "doubleSlash"
    | "eyePoke"
    | "bite"
    | "breathFire"
    | "paralyze"
    | "blind"
    | "teleport"
    | "hpSwap";

const AbilitiesEnum = [
    "bandage",
    "disintegrate",
    "bruise",
    "doubleSlash",
    "eyePoke",
    "bite",
    "breathFire",
    "paralyze",
    "blind",
    "teleport",
    "hpSwap",
] as const;

interface Ability {
    ability: Abilities;
    type: AbilityType;
    description: string;
    procedures: Procedure[];
    cost: Partial<EntityStats & CurrencyParams>;
    range: number; // range of the ability (number of unit precision geohashes)
    aoe: number; // area of effect (number of unit precision geohashes)
    predicate: {
        self: EntityType[];
        target: EntityType[];
        targetSelfAllowed: boolean;
    };
}

type ProcedureStateEffects = "loc" | "locT" | "locI" | Stat | Currency;

type Procedure = ["action" | "check", ProcedureEffect];
interface ProcedureEffect {
    target: "self" | "target";
    ticks: number;
    dieRoll?: DieRoll; // damage rolls, damage type, modifier used for damage roll
    modifiers?: Attribute[]; // modifier used for attack rolls & saving throws
    debuffs?: {
        debuff: Debuff;
        op: "push" | "pop" | "contains" | "doesNotContain";
    };
    buffs?: {
        buff: Buff;
        op: "push" | "pop" | "contains" | "doesNotContain";
    };
    states?: {
        [state in ProcedureStateEffects]?: {
            op: "change" | "subtract" | "add";
            value: number | string | boolean | string[];
        };
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
    self: Actor;
    target: Actor;
}): ProcedureEffect {
    const effectClone = cloneDeep(effect); // don't modify the template

    // States
    if (effectClone.states) {
        for (const [s, state] of Object.entries(effectClone.states)) {
            if (typeof state.value === "string") {
                const value = substituteVariables(state.value, {
                    self,
                    target,
                });

                // loc
                if (s === "loc") {
                    if (!Array.isArray(value)) {
                        throw new Error(
                            "Patched value for `loc` must be type string[]",
                        );
                    }
                    state.value = value;
                }
                // locT
                else if (s === "locT") {
                    if (typeof value !== "string") {
                        throw new Error(
                            "Patched value for `locT` must be type `string`",
                        );
                    }
                    state.value = value;
                }
                // locT
                else if (s === "locI") {
                    if (typeof value !== "string") {
                        throw new Error(
                            "Patched value for `locI` must be type `string`",
                        );
                    }
                    state.value = value;
                }
                // ap, mp, hp, st
                else {
                    if (typeof value !== "number") {
                        throw new Error(
                            "Patched value for hp/mp/ap/st must be type `number`",
                        );
                    }
                    state.value = parseInt(value as any);
                }
            }
        }
    }

    return effectClone;
}

function hasResourcesForAbility(
    self: Creature,
    ability: Abilities,
): { hasResources: boolean; message: string } {
    for (const [res, amt] of Object.entries(abilities[ability].cost)) {
        if (self[res as Currency | Stat] < amt) {
            return {
                hasResources: false,
                message: `You do not have enough ${describeResource[res as Currency | Stat]} to ${ability}.`,
            };
        }
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
    ability: Abilities;
    self: Creature;
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

function getPlayerAbilities(player: Player): Ability[] {
    // TODO: to be implemented based on level etc ... (to also include check in backend)
    const playerAbilities: Ability[] = Object.values(abilities);

    return playerAbilities;
}
