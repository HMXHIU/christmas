import type { Prop } from "../../compendium";
import { abilities } from "../abilities";

export let consumables: Record<string, Prop> = {
    tradewrit: {
        prop: "tradewrit",
        asset: {
            path: "props/writ", // TODO: Add asset
        },
        durability: 1,
        charges: 1,
        weight: 1,
        collider: false,
        states: {
            default: {
                name: "Trade writ",
                destructible: true,
                description:
                    "A formal document issued by the merchant guild. The merchant is offering ${offer} for ${receive}. You may *fulfill* this writ.",
                variant: "default",
            },
        },
        utilities: {},
        variables: {
            // Description of items merchant should receive
            receive: {
                variable: "receive",
                type: "string",
                value: "",
            },
            // Description of items merchant is offering
            offer: {
                variable: "offer",
                type: "string",
                value: "",
            },
            // This is the JWT token containing the writ information (the buyer and seller are inside)
            token: {
                variable: "token",
                type: "string",
                value: "",
            },
        },
    },
    bread: {
        prop: "bread",
        asset: {
            path: "props/debug/circle", // TODO: Add asset
            normal: true,
        },
        durability: 1,
        charges: 1,
        weight: 1,
        collider: false,
        food: true,
        states: {
            default: {
                name: "Unremarkable bread.",
                destructible: true,
                description:
                    "This bread is so plain it might be the universal standard for 'edible.' With a crust that’s neither soft nor crunchy and a flavor profile hovering somewhere between 'meh' and 'mildly disappointing,' it somehow remains essential. Best enjoyed with an optimistic attitude.",
                variant: "default",
            },
        },
        utilities: {},
        variables: {},
    },
    potionofhealth: {
        prop: "potionofhealth",
        asset: {
            path: "props/potions", // TODO: Add asset
            variants: {
                default: "red-potion",
            },
        },
        durability: 100,
        charges: 5,
        weight: 1,
        collider: false,
        equipment: { slot: "bl" },
        states: {
            default: {
                name: "Potion of Health",
                destructible: true,
                description:
                    "A bottle of clear crystal glass. You see a faint glowing red liquid inside.",
                variant: "default",
            },
        },
        utilities: {
            sip: {
                utility: "sip",
                description: "Sip the potion to restore health.",
                cost: {
                    charges: 1,
                    durability: 0,
                },
                state: {
                    start: "default",
                    end: "default",
                },
                ability: abilities.heal.ability,
            },
        },
        variables: {},
    },
    // TODO: Spawn a player unique instance of a dungeon
    dungeonkey: {
        prop: "dungeonkey",
        asset: {
            path: "props/gothic",
            variants: {
                default: "ritual-circle",
            },
        },
        durability: 1,
        charges: 1,
        weight: 0.1,
        collider: false,
        states: {
            default: {
                name: "Dungeon Key",
                destructible: false,
                description: "A key to a dungeon.",
                variant: "default",
            },
        },
        variables: {
            target: {
                variable: "target",
                type: "item",
                value: "",
            },
        },
        utilities: {
            use: {
                utility: "use",
                description: "Use the key.",
                cost: {
                    charges: 1,
                    durability: 0,
                },
                state: {
                    start: "default",
                    end: "default",
                },
                action: "enter", // spawn and enter into a world defined by this key
            },
        },
    },
};
