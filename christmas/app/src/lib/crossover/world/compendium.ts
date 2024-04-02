import type {
    EntityType,
    ItemEntity,
} from "$lib/server/crossover/redis/entities";
import { substituteVariables } from "$lib/utils";
import lodash from "lodash";
import type { AssetMetadata } from ".";
import { abilities } from "./abilities";
const { cloneDeep } = lodash;

export {
    compendium,
    itemAttibutes,
    type EquipmentSlot,
    type ItemVariables,
    type Prop,
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

/**
 * `Prop` is a template used to create an `item` instance
 */
interface Prop extends PropStats {
    prop: string;
    defaultName: string;
    defaultState: string;
    asset: AssetMetadata;
    states: Record<string, PropAttributes>;
    actions: Record<string, PropAction>;
    variables: PropVariables; // configurable variables to alter prop behavior & descriptions
    equipmentSlot?: EquipmentSlot[];
}

interface PropStats {
    durability: number;
    charges: number; // needs to be recharged (every day or via item)
}

interface PropAttributes {
    description: string;
    traversable: number;
    destructible: boolean;
    variant: string;
}

interface PropAction {
    action: string;
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

// interface ItemVariables {
//     [key: string]: string | number | boolean;
// }

/**
 * `compendium` is a collection of `Prop` templates used  to create `item` instances.
 */
let compendium: Record<string, Prop> = {
    woodenClub: {
        prop: "woodenClub",
        defaultName: "Wooden Club",
        asset: {
            bundle: "props",
            name: "weapons",
            variants: {
                default: "wooden-club",
            },
        },
        durability: 100,
        charges: 0,
        equipmentSlot: ["rh", "lh"],
        defaultState: "default",
        states: {
            default: {
                traversable: 1.0,
                destructible: true,
                description: "A simple wooden club ${etching}.", // ${} for string substitution
                variant: "default",
            },
        },
        actions: {
            swing: {
                action: "swing",
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
    potionOfHealth: {
        prop: "potionOfHealth",
        defaultName: "Potion of Health",
        // TODO: Add potion asset
        asset: {
            bundle: "props",
            name: "potions",
            variants: {
                default: "red-potion",
            },
        },
        durability: 100,
        charges: 5,
        defaultState: "default",
        states: {
            default: {
                traversable: 1.0,
                destructible: true,
                description:
                    "A bottle of clear crystal glass. You see a faint glowing red liquid inside.",
                variant: "default",
            },
        },
        actions: {
            sip: {
                action: "sip",
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
    woodenDoor: {
        prop: "woodenDoor",
        defaultName: "Wooden Door",
        asset: {
            bundle: "props",
            name: "gothic",
            variants: {
                default: "wood-door-1",
                closed: "wood-door-2",
            },
        },
        defaultState: "closed",
        durability: 100,
        charges: 0,
        states: {
            open: {
                traversable: 1.0,
                destructible: false,
                description: "${doorSign}. The door is open.",
                variant: "default",
            },
            closed: {
                traversable: 0,
                destructible: false,
                description: "${doorSign}. The door is closed.",
                variant: "closed",
            },
        },
        actions: {
            open: {
                action: "open",
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
                action: "close",
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
            doorSign: {
                variable: "doorSign",
                type: "string",
                value: "Just a plain wooden door",
            },
        },
    },
    portal: {
        prop: "portal",
        defaultName: "Portal",
        asset: {
            bundle: "props",
            name: "gothic",
            variants: {
                default: "ritual-circle",
            },
        },
        durability: 100,
        charges: 100,
        defaultState: "default",
        states: {
            default: {
                traversable: 1.0,
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
        actions: {
            teleport: {
                action: "teleport",
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
 * Retrieves the attributes of an item from its prop and performs variable substitution.
 *
 * @param item - The item entity for which to retrieve the attributes.
 * @returns The attributes of the item after variable substitution.
 */
function itemAttibutes(item: ItemEntity): PropAttributes {
    const state = cloneDeep(compendium[item.prop].states[item.state]);
    const variables = JSON.parse(item.variables);
    // Replace variables in description
    state.description = substituteVariables(
        state.description,
        variables,
    ) as string;
    return state;
}
