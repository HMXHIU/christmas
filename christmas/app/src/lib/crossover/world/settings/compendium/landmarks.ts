import type { Prop } from "../../compendium";
import { abilities } from "../abilities";

export let landmarks: Record<string, Prop> = {
    dungeonentrance: {
        prop: "dungeonentrance",
        defaultName: "Dungeon",
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
        defaultState: "default",
        states: {
            default: {
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
                state: {
                    start: "default",
                    end: "default",
                },
                ability: abilities.teleport.ability,
            },
        },
    },
};
