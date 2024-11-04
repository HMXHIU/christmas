import { TICKS_PER_TURN } from "..";
import type { Abilities, Ability } from "../../abilities";

export { healingAbilities };

const healingAbilities: Partial<Record<Abilities, Ability>> = {
    bandage: {
        ability: "bandage",
        type: "healing",
        description: "Bandages the player's wounds.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    dieRoll: {
                        count: 1,
                        sides: -6, // negative damage = healing
                        damageType: "healing",
                        modifiers: ["con"], // used for damage roll
                    },
                    modifiers: ["con"], // used for attack roll
                    ticks: TICKS_PER_TURN,
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
    heal: {
        ability: "heal",
        type: "healing",
        description: "Heal youself.",
        procedures: [
            [
                "action",
                {
                    target: "self",
                    dieRoll: {
                        count: 1,
                        sides: -6, // negative damage = healing
                        damageType: "healing",
                        modifiers: ["con"], // used for damage roll
                    },
                    modifiers: ["con"], // used for attack roll
                    ticks: TICKS_PER_TURN,
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
            target: [],
            targetSelfAllowed: true,
        },
    },
    regenerate: {
        ability: "regenerate",
        type: "healing",
        description: "Heal youself periodically.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    conditions: {
                        condition: "regeneration",
                        op: "push",
                    },
                    modifiers: ["con"],
                    ticks: TICKS_PER_TURN,
                },
            ],
        ],
        cost: {
            lum: 10,
        },
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: [],
            targetSelfAllowed: true,
        },
    },
};
