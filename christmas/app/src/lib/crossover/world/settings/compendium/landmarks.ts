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
        collider: true,
        states: {
            default: {
                name: "${name}",
                destructible: false,
                description: `$\{description}

$\{influence}

The Monument of Control grants a faction significant influence over the region.
As control shifts, the surrounding landscape gradually transforms to reflect its nature - lush forests may wither into barren wastelands, or harsh deserts might bloom into verdant oases.`,
                variant: "default",
            },
        },
        variables: {
            name: {
                variable: "name",
                type: "string",
                value: "Monument of Control",
            },
            description: {
                variable: "description",
                type: "string",
                value: `The monument stands as a towering monolith of shimmering, iridescent crystal. 
Its surface pulses with an otherworldly energy, casting a soft glow on the surrounding area. 
Ancient runes carved into its base hint at its power to shape the very fabric of the world.`,
            },
            influence: {
                variable: "influence",
                type: "string",
                value: "You sense no influence from this monument.",
            },
            receive: {
                variable: "receive",
                type: "string",
                value: "currency:lum, currency:umb", // this is a special format
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
