import type { Prop } from "../../compendium";
import { abilities } from "../abilities";

export let weapons: Record<string, Prop> = {
    woodenclub: {
        prop: "woodenclub",
        defaultName: "Wooden Club",
        asset: {
            path: "bestiary/goblin",
            variants: {
                default: "wooden-club",
            },
        },
        durability: 100,
        charges: 0,
        weight: 3,
        collider: false,
        equipmentSlot: ["rh", "lh"],
        defaultState: "default",
        states: {
            default: {
                destructible: true,
                description: "A simple wooden club. ${etching}", // ${} for string substitution
                variant: "default",
            },
        },
        utilities: {
            swing: {
                utility: "swing",
                description: "Swing the club at a target.",
                cost: {
                    charges: 0,
                    durability: 1,
                },
                state: {
                    start: "default",
                    end: "default",
                },
                ability: abilities.swing.ability,
                requireEquipped: true,
            },
        },
        variables: {
            etching: {
                variable: "etching",
                type: "string",
                value: "There is nothing etched on the club.",
            },
        },
    },
};
