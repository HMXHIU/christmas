import type { EntityType, Item } from "$lib/server/crossover/redis/entities";
import { substituteVariables } from "$lib/utils";
import lodash from "lodash";
import { abilities } from "./abilities";
import { type AssetMetadata } from "./types";
import { worldSeed } from "./world";
const { cloneDeep } = lodash;

export {
    EquipmentSlots,
    compendium,
    itemAttibutes,
    type EquipmentSlot,
    type ItemVariables,
    type Prop,
    type Utility,
};

type EquipmentSlot =
    | "rh" // right hand
    | "lh" // left hand
    | "ft" // feet
    | "hd" // head
    | "nk" // neck
    | "ch" // chest
    | "lg" // legs
    | "r1" // ring 1
    | "r2"; // ring 2

const EquipmentSlots: EquipmentSlot[] = [
    "rh",
    "lh",
    "ft",
    "hd",
    "nk",
    "ch",
    "lg",
    "r1",
    "r2",
];

/**
 * `Prop` is a template used to create an `item` instance
 */
interface Prop {
    prop: string;
    defaultName: string;
    defaultState: string;
    asset: AssetMetadata;
    durability: number;
    charges: number;
    states: Record<string, PropAttributes>; // map item.state to prop attributes
    utilities: Record<string, Utility>;
    variables: PropVariables; // configurable variables to alter prop behavior & descriptions
    equipmentSlot?: EquipmentSlot[];
    weight: number; // -1 means it cannot be taken
    collider: boolean; // cannot have more than 1 collidable item in the same location, cannot walk through collidable items
}

interface PropAttributes {
    description: string;
    destructible: boolean;
    variant: string;
}

interface Utility {
    utility: string;
    description: string;
    cost: {
        charges: number;
        durability: number;
    };
    state: {
        start: string;
        end: string;
    };
    // abilities[ability] `self` and `target` will be provided when `useItem` is called but can be overwritten via `variables`
    ability?: string;
    requireEquipped?: boolean; // defaults to false
}

interface PropVariables {
    [key: string]: {
        variable: string;
        type: "string" | "number" | "boolean" | EntityType;
        value: string | number | boolean;
    };
}

type ItemVariables = Record<string, string | number | boolean>;

/**
 * `compendium` is a collection of `Prop` templates used  to create `item` instances.
 */
let compendium: Record<string, Prop> = {
    woodenclub: {
        prop: "woodenclub",
        defaultName: "Wooden Club",
        asset: {
            path: "bestiary/goblin",
            variants: {
                default: "wooden-club",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
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
                description: "A simple wooden club ${etching}.", // ${} for string substitution
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
                value: "Nothing etched on the club",
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
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
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
    woodendoor: {
        prop: "woodendoor",
        defaultName: "Wooden Door",
        asset: {
            path: "props/gothic",
            variants: {
                default: "wood-door-2", // open
                closed: "wood-door-1",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
        defaultState: "closed",
        durability: 100,
        charges: 0,
        weight: -1,
        collider: true,
        states: {
            open: {
                destructible: false,
                description: "${doorsign}. The door is open.",
                variant: "default",
            },
            closed: {
                destructible: false,
                description: "${doorsign}. The door is closed.",
                variant: "closed",
            },
        },
        utilities: {
            open: {
                utility: "open",
                description: "Open the door.",
                cost: {
                    charges: 0,
                    durability: 0,
                },
                state: {
                    start: "closed",
                    end: "open",
                },
            },
            close: {
                utility: "close",
                description: "Close the door.",
                cost: {
                    charges: 0,
                    durability: 0,
                },
                state: {
                    start: "open",
                    end: "closed",
                },
            },
        },
        variables: {
            doorsign: {
                variable: "doorsign",
                type: "string",
                value: "Just a plain wooden door",
            },
        },
    },
    tavern: {
        prop: "tavern",
        defaultName: "Tavern",
        // TODO: Add tavern asset
        asset: {
            path: "props/gothic",
            variants: {
                default: "tavern",
            },
            width: 2,
            height: 2,
            precision: worldSeed.spatial.unit.precision,
        },
        defaultState: "default",
        durability: 100,
        charges: 0,
        weight: -1, // cannot be taken
        collider: true,
        states: {
            default: {
                destructible: false,
                description: "A humble tavern. ${description}",
                variant: "default",
            },
        },
        utilities: {},
        variables: {
            description: {
                variable: "description",
                type: "string",
                value: "A plain wooden door greets you.",
            },
        },
    },
    debris: {
        prop: "debris",
        defaultName: "Debris",
        asset: {
            path: "props/gothic",
            variants: {
                default: "debris-9",
            },
            width: 2,
            height: 2,
            precision: worldSeed.spatial.unit.precision,
        },
        defaultState: "default",
        durability: 100,
        charges: 0,
        weight: -1, // cannot be taken
        collider: true,
        states: {
            default: {
                destructible: false,
                description: "Impassable debris",
                variant: "default",
            },
        },
        utilities: {},
        variables: {},
    },
    portal: {
        prop: "portal",
        defaultName: "Portal",
        asset: {
            path: "props/gothic",
            variants: {
                default: "ritual-circle",
            },
            width: 2,
            height: 2,
            precision: worldSeed.spatial.unit.precision,
        },
        durability: 100,
        charges: 100,
        weight: -1,
        collider: false,
        defaultState: "default",
        states: {
            default: {
                destructible: false,
                description:
                    "${description}. It is tuned to teleport to ${target}.",
                variant: "default",
            },
        },
        variables: {
            // Can be used to overwrite `target` or `self` provided by `useItem`
            target: {
                variable: "target",
                type: "item", // portal's target is bound to an item to teleport to (another portal)
                value: "",
            },
            description: {
                variable: "description",
                type: "string",
                value: "A portal pulsing with magical energy",
            },
        },
        utilities: {
            teleport: {
                utility: "teleport",
                description: "Step through the portal.",
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

/**
 * Retrieves the attributes of an item in its current state from its prop and performs variable substitution.
 *
 * @param item - The item entity for which to retrieve the attributes.
 * @returns The attributes of the item after variable substitution.
 */
function itemAttibutes(item: Item): PropAttributes {
    const state = cloneDeep(compendium[item.prop].states[item.state]);
    // Replace variables in description
    state.description = substituteVariables(
        state.description,
        item.vars,
    ) as string;
    return state;
}
