import { TICKS_PER_TURN } from "..";
import type { Abilities, Ability } from "../../abilities";

export { utilityAbilities };

const utilityAbilities: Partial<Record<Abilities, Ability>> = {
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
                        loc: {
                            value: "{{target.loc}}", // {{}} for variable access
                            op: "change",
                        },
                        locT: {
                            value: "{{target.locT}}",
                            op: "change",
                        },
                        locI: {
                            value: "{{target.locI}}",
                            op: "change",
                        },
                    },
                    ticks: TICKS_PER_TURN,
                },
            ],
        ],
        cost: {
            mnd: 3,
        },
        range: -1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster", "item"],
            targetSelfAllowed: false,
        },
    },
    hpSwap: {
        ability: "hpSwap",
        type: "offensive",
        description: "Swap HP with target.",
        procedures: [
            [
                "action",
                {
                    target: "self",
                    states: {
                        hp: {
                            value: "{{target.hp}}", // {{}} for variable access
                            op: "change",
                        },
                    },
                    modifiers: ["fth"],
                    ticks: 0,
                },
            ],
            [
                "action",
                {
                    target: "target",
                    states: {
                        hp: {
                            value: "{{self.hp}}", // {{}} for variable access
                            op: "change",
                        },
                    },
                    modifiers: ["fth"],
                    ticks: TICKS_PER_TURN,
                },
            ],
        ],
        cost: {
            umb: 3,
        },
        range: 2,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster", "item"],
            targetSelfAllowed: false,
        },
    },
};
