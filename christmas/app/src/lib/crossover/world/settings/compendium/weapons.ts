import type { Prop } from "../../compendium";
import { abilities } from "../abilities";

export let weapons: Record<string, Prop> = {
    woodenclub: {
        prop: "woodenclub",
        asset: {
            path: "bestiary/goblin",
            variants: {
                default: "wooden-club",
            },
        },
        durability: 100, // reduces with normal attacks
        charges: 5, // reduces when using utilities
        weight: 3,
        collider: false,
        equipmentSlot: "hn",
        dieRoll: {
            count: 1,
            sides: 6,
            modifiers: ["str"],
            damageType: "blunt",
        },
        states: {
            default: {
                name: "Wooden Club",
                destructible: true,
                description: "A simple wooden club. ${etching}", // ${} for string substitution
                variant: "default",
            },
        },
        utilities: {
            swing: {
                utility: "swing",
                description: "Swing the club with all your strength.",
                cost: {
                    charges: 1,
                    durability: 0,
                },
                state: {
                    start: "default",
                    end: "default",
                },
                ability: abilities.bruise.ability,
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
