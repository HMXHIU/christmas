import type {
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { substituteVariables } from "$lib/utils";
import lodash from "lodash";
import { geohashToCell } from ".";
const { cloneDeep } = lodash;

export {
    abilities,
    canPerformAbility,
    fillInEffectVariables,
    performAbility,
    type Ability,
    type AbilityType,
    type AfterProcedures,
    type BeforeProcedures,
    type Buff,
    type DamageType,
    type Debuff,
    type OnProcedure,
    type PerformAbilityCallbacks,
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

type State = "geohash" | "ap" | "hp" | "mp" | "st";

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
        value: number | string | boolean;
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
                },
            ],
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "slashing" },
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
                },
            ],
            [
                "check",
                {
                    target: "target",
                    debuffs: { debuff: "blinded", op: "contains" },
                },
            ],
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "piercing" },
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
                },
            ],
            [
                "check",
                {
                    target: "target",
                    debuffs: { debuff: "wet", op: "doesNotContain" },
                },
            ],
            [
                "action",
                {
                    target: "target",
                    debuffs: { debuff: "burning", op: "push" },
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
                        state: "geohash",
                        value: "${target.geohash}",
                        op: "change",
                    },
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

function performEffect({
    entity,
    effect,
}: {
    entity: PlayerEntity | MonsterEntity | ItemEntity;
    effect: ProcedureEffect;
}): PlayerEntity | MonsterEntity | ItemEntity {
    // TODO: return success or fail if resisted
    // Damage
    if (effect.damage) {
        // Player or monster
        if (entity.player || entity.monster) {
            entity.hp = Math.max(
                0,
                (entity as PlayerEntity | MonsterEntity).hp -
                    effect.damage.amount,
            );
        }
        // Item
        else if (entity.item) {
            entity.durability = Math.max(
                0,
                (entity as ItemEntity).durability - effect.damage.amount,
            );
        }
    }

    // Debuff
    if (effect.debuffs) {
        const { debuff, op } = effect.debuffs;
        if (op === "push") {
            if (!entity.debuffs.includes(debuff)) {
                entity.debuffs.push(debuff);
            }
        } else if (op === "pop") {
            entity.debuffs = entity.debuffs.filter((d) => d !== debuff);
        }
    }

    // State
    if (effect.states) {
        const { state, op, value } = effect.states;
        if (entity.hasOwnProperty(state)) {
            if (op === "change") {
                (entity as any)[state] = value;
            } else if (op === "subtract" && state) {
                (entity as any)[state] -= value as number;
            } else if (op === "add") {
                (entity as any)[state] += value as number;
            }
        }
    }

    return entity;
}

function performCheck({
    entity,
    effect,
}: {
    entity: PlayerEntity | MonsterEntity | ItemEntity;
    effect: ProcedureEffect;
}): boolean {
    const { debuffs, buffs } = effect;

    if (debuffs) {
        const { debuff, op } = debuffs;
        if (op === "contains") {
            return entity.debuffs.includes(debuff);
        } else if (op === "doesNotContain") {
            return !entity.debuffs.includes(debuff);
        }
    }

    if (buffs) {
        const { buff, op } = buffs;
        if (op === "contains") {
            return entity.buffs.includes(buff);
        } else if (op === "doesNotContain") {
            return !entity.buffs.includes(buff);
        }
    }

    return false;
}

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

interface PerformAbilityCallbacks {
    onProcedure?: OnProcedure;
    beforeProcedures?: BeforeProcedures;
    afterProcedures?: AfterProcedures;
}

interface PerformAbilityOptions extends PerformAbilityCallbacks {
    ignoreCost?: boolean;
}

async function performAbility(
    {
        self,
        target,
        ability,
    }: {
        self: PlayerEntity | MonsterEntity; // self can only be a `player` or `monster`
        target: PlayerEntity | MonsterEntity | ItemEntity; // target can be an `item`
        ability: string;
    },
    options: PerformAbilityOptions = {},
): Promise<{
    self: PlayerEntity | MonsterEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity;
    status: "success" | "failure";
    message: string;
}> {
    const { procedures, ap, mp, st, hp, range } = abilities[ability];
    const { onProcedure, beforeProcedures, afterProcedures, ignoreCost } =
        options;

    // Check if self has enough resources to perform ability
    if (!ignoreCost && !canPerformAbility(self, ability)) {
        return {
            self,
            target,
            status: "failure",
            message: "Not enough resources to perform ability",
        };
    }

    // Check if target is in range
    if (!checkInRange(self, target, range)) {
        return {
            self,
            target,
            status: "failure",
            message: "Target out of range",
        };
    }

    // Expend ability costs
    if (!ignoreCost) {
        self.ap -= ap;
        self.mp -= mp;
        self.st -= st;
        self.hp -= hp;
    }

    if (beforeProcedures) {
        await beforeProcedures({ self, target, ability });
    }

    for (const [type, effect] of procedures) {
        if (type === "action") {
            const actualEffect = fillInEffectVariables({
                effect,
                self,
                target,
            });

            if (effect.target === "self") {
                self = performEffect({ entity: self, effect: actualEffect }) as
                    | PlayerEntity
                    | MonsterEntity;
                // TODO: only call onProcedure if the effect was successful
                if (onProcedure) {
                    await onProcedure({
                        target: self,
                        effect: actualEffect,
                    });
                }
            } else if (effect.target === "target") {
                target = performEffect({
                    entity: target,
                    effect: actualEffect,
                });
                if (onProcedure) {
                    await onProcedure({
                        target,
                        effect: actualEffect,
                    });
                }
            }
        } else if (type === "check") {
            if (effect.target === "self") {
                if (!performCheck({ entity: self, effect })) break;
            } else if (effect.target === "target") {
                if (!performCheck({ entity: target, effect })) break;
            }
        }
    }

    if (afterProcedures) {
        await afterProcedures({ self, target, ability });
    }

    return { self, target, status: "success", message: "" };
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
        effectClone.damage.amount = parseInt(
            substituteVariables(effectClone.damage.amount, {
                self,
                target,
            }),
        );
    }

    // States
    if (typeof effectClone.states?.value === "string") {
        const value = substituteVariables(effectClone.states.value, {
            self,
            target,
        });
        if (effectClone.states.state === "geohash") {
            effectClone.states.value = value;
        } else {
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
    const { row: r1, col: c1 } = geohashToCell(self.geohash);
    const { row: r2, col: c2 } = geohashToCell(target.geohash);
    const inRange =
        range < 0 ||
        Math.ceil(Math.sqrt((r1 - r2) ** 2 + (c1 - c2) ** 2)) <= range;
    return inRange;
}
