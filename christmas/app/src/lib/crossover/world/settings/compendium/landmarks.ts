import type { Prop } from "../../compendium";
import { abilities } from "../abilities";

export let landmarks: Record<string, Prop> = {
    control: {
        prop: "control",
        asset: {
            path: "props/gothic",
            variants: {
                default: "ritual-circle",
            },
            width: 2,
            height: 2,
        },
        durability: 100,
        charges: 100,
        weight: -1,
        collider: true, // untraversable, cannot spawn 2 in same location
        states: {
            default: {
                name: "${name}",
                destructible: false,
                description: "${description}",
                variant: "default",
            },
        },
        variables: {
            name: {
                variable: "name",
                type: "string",
                value: "Control Point",
            },
            description: {
                variable: "description",
                type: "string",
                value: "Control an area.",
            },
            receive: {
                variable: "receive",
                type: "string",
                value: "currency:lum, currency:umb", // this is a special format
            },
            // Faction control (increase influence by the `capture` action)
            human: {
                variable: "human",
                type: "number",
                value: 0,
            },
            goblin: {
                variable: "goblin",
                type: "number",
                value: 0,
            },
        },
        utilities: {},
    },
    dungeonentrance: {
        prop: "dungeonentrance",
        asset: {
            path: "props/gothic",
            variants: {
                default: "ritual-circle",
            },
            width: 2,
            height: 2,
        },
        durability: 100,
        charges: 100,
        weight: -1,
        collider: true, // untraversable, cannot spawn 2 in same location
        states: {
            default: {
                name: "Dungeon Entrance",
                destructible: false,
                description: "An opening in the ground.",
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
            enter: {
                utility: "enter",
                description: "Step through opening.",
                cost: {
                    charges: 1,
                    durability: 0,
                },
                range: 2,
                state: {
                    start: "default",
                    end: "default",
                },
                ability: abilities.teleport.ability,
            },
        },
    },
};
