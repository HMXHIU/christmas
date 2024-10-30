import { TICKS_PER_TURN } from "..";
import type { Abilities, Ability } from "../../abilities";

export { offensiveAbilities };

const offensiveAbilities: Partial<Record<Abilities, Ability>> = {
    disintegrate: {
        ability: "disintegrate",
        type: "offensive",
        description: "Disintegrates the target. [FOR TESTING ONLY]",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    dieRoll: {
                        count: 5,
                        sides: 20,
                        damageType: "necrotic",
                        modifiers: ["cha"],
                    },
                    modifiers: ["cha"],
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        cost: {
            cha: 3,
        },
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: false,
        },
    },
    bruise: {
        ability: "bruise",
        type: "offensive",
        description: "A blunt strike.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    dieRoll: {
                        count: 2,
                        sides: 8,
                        damageType: "blunt",
                        modifiers: ["str"],
                    },
                    modifiers: ["str"],
                    ticks: 1,
                },
            ],
        ],
        cost: {
            mnd: 1,
        },
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
                    dieRoll: {
                        count: 1,
                        sides: 8,
                        damageType: "slashing",
                        modifiers: ["str", "dex"],
                    },
                    modifiers: ["str", "dex"],
                    ticks: 1,
                },
            ],
            [
                "action",
                {
                    target: "target",
                    dieRoll: {
                        count: 1,
                        sides: 8,
                        damageType: "slashing",
                        modifiers: ["str", "dex"],
                    },
                    modifiers: ["str", "dex"],
                    ticks: 1,
                },
            ],
        ],
        cost: {
            mnd: 1,
        },
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
                    conditions: {
                        condition: "blinded",
                        op: "push",
                    },
                    modifiers: ["dex"],
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
            [
                "check",
                {
                    target: "target",
                    conditions: { condition: "blinded", op: "contains" },
                    ticks: 0,
                },
            ],
            [
                "action",
                {
                    target: "target",
                    dieRoll: {
                        count: 1,
                        sides: 6,
                        damageType: "piercing",
                        modifiers: ["dex"],
                    },
                    modifiers: ["dex"],
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        cost: {
            mnd: 1,
        },
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
                    dieRoll: {
                        count: 1,
                        sides: 6,
                        damageType: "piercing",
                        modifiers: ["dex", "str"],
                    },
                    modifiers: ["dex", "str"],
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        cost: {
            mnd: 1,
        },
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
                    dieRoll: {
                        count: 3,
                        sides: 6,
                        damageType: "fire",
                        modifiers: ["mnd", "cha", "fth"],
                    },
                    modifiers: ["mnd", "cha", "fth"],
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
            [
                "check",
                {
                    target: "target",
                    conditions: {
                        condition: "wet",
                        op: "doesNotContain",
                    },
                    ticks: 0,
                },
            ],
            [
                "action",
                {
                    target: "target",
                    conditions: {
                        condition: "burning",
                        op: "push",
                    },
                    modifiers: ["dex"],
                    ticks: 0,
                },
            ],
        ],
        cost: {
            cha: 2,
        },
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
                    conditions: {
                        condition: "paralyzed",
                        op: "push",
                    },
                    modifiers: ["mnd"],
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        cost: {
            mnd: 1,
        },
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
                    conditions: { condition: "blinded", op: "push" },
                    modifiers: ["con"],
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        cost: {
            mnd: 1,
        },
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
    },
};
