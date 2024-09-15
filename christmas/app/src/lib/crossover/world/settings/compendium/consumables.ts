import type { Prop } from "../../compendium";
import { abilities } from "../abilities";

export let consumables: Record<string, Prop> = {
    tradewrit: {
        prop: "tradewrit",
        defaultName: "Trade writ",
        asset: {
            path: "props/writ", // TODO: Add asset
        },
        durability: 1,
        charges: 1,
        weight: 1,
        collider: false,
        defaultState: "default",
        states: {
            default: {
                destructible: true,
                description:
                    "A formal document issued by the merchant guild. ${order}. You may *execute* the writ to finalize the trade.",
                variant: "default",
            },
        },
        utilities: {},
        variables: {
            // 'sell' or 'buy'
            order: {
                variable: "order",
                type: "string",
                value: "",
            },
            // Description of items buyer will receive
            receive: {
                variable: "receive",
                type: "string",
                value: "",
            },
            // Description of items buyer is offering
            offer: {
                variable: "offer",
                type: "string",
                value: "",
            },
            // This is the JWT token containing the writ information
            token: {
                variable: "token",
                type: "string",
                value: "",
            },
        },
    },
    potionofhealth: {
        prop: "potionofhealth",
        defaultName: "Potion of Health",
        // TODO: Add potion asset
        asset: {
            path: "props/potions",
            variants: {
                default: "red-potion",
            },
        },
        durability: 100,
        charges: 5,
        weight: 1,
        collider: false,
        defaultState: "default",
        states: {
            default: {
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
                ability: abilities.bandage.ability,
            },
        },
        variables: {},
    },
    dungeonkey: {
        prop: "dungeonkey",
        defaultName: "Dungeon",
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
        defaultState: "default",
        states: {
            default: {
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
