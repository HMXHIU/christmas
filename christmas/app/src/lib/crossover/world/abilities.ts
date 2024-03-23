import type {
    MonsterEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { geohashToCell } from ".";

export {
    abilities,
    canPerformAbility,
    performAbility,
    type Ability,
    type AbilityType,
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
};

function performAction({
    entity,
    effect,
}: {
    entity: PlayerEntity | MonsterEntity;
    effect: ProcedureEffect;
}): PlayerEntity | MonsterEntity {
    // TODO: return success of fail if resisted

    if (effect.damage) {
        entity.hp = Math.max(0, entity.hp - effect.damage.amount);
    }

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

    return entity;
}

function performCheck({
    entity,
    effect,
}: {
    entity: PlayerEntity | MonsterEntity;
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
    target: PlayerEntity | MonsterEntity;
    effect: ProcedureEffect;
}) => void;

function performAbility(
    {
        self,
        target,
        ability,
    }: {
        self: PlayerEntity | MonsterEntity;
        target: PlayerEntity | MonsterEntity;
        ability: string;
    },
    onProcedure?: OnProcedure,
): {
    self: PlayerEntity | MonsterEntity;
    target: PlayerEntity | MonsterEntity;
    status: "success" | "failure";
    message: string;
} {
    const { procedures, ap, mp, st, hp, range } = abilities[ability];

    // Check if self has enough AP
    if (self.ap < ap) {
        return { self, target, status: "failure", message: "Not enough AP" };
    }

    // Check within range
    const { row: r1, col: c1 } = geohashToCell(self.geohash);
    const { row: r2, col: c2 } = geohashToCell(target.geohash);
    const inRange =
        Math.ceil(Math.sqrt((r1 - r2) ** 2 + (c1 - c2) ** 2)) <= range;
    if (!inRange) {
        return { self, target, status: "failure", message: "Out of range" };
    }

    // Expend ability costs
    self.ap -= ap;
    self.mp -= mp;
    self.st -= st;
    self.hp -= hp;

    for (const [type, effect] of procedures) {
        if (type === "action") {
            if (effect.target === "self") {
                self = performAction({ entity: self, effect });
                // TODO: only call onProcedure if the effect was successful
                if (onProcedure) {
                    onProcedure({
                        target: self,
                        effect,
                    });
                }
            } else if (effect.target === "target") {
                target = performAction({ entity: target, effect });
                if (onProcedure) {
                    onProcedure({
                        target,
                        effect,
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
    return { self, target, status: "success", message: "" };
}

function canPerformAbility(
    self: PlayerEntity | MonsterEntity,
    ability: string,
) {
    const { ap, mp, st, hp } = abilities[ability];
    return self.ap >= ap && self.mp >= mp && self.st >= st && self.hp >= hp;
}
