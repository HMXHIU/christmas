import type {
    EntityType,
    ItemEntity,
} from "$lib/server/crossover/redis/entities";
import { substituteVariables } from "$lib/utils";
import type { AssetMetadata } from ".";
import { abilities } from "./abilities";

export { compendium, itemAttibutes, type Prop };

/**
 * `Prop` is a template used to create an `item` instance
 */
interface Prop extends PropStats {
    prop: string;
    defaultName: string;
    defaultState: string;
    asset: AssetMetadata;
    states: Record<string, PropAttributes>;
    actions?: Record<string, PropAction>;
    variables?: PropVariables; // configurable variables to alter prop behavior & descriptions
}

interface PropStats {
    durability: number;
    charges: number; // needs to be recharged (every day or via item)
}

interface PropAttributes {
    description: string;
    traversable: number;
    desctructible: boolean;
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
}

interface PropVariables {
    [key: string]: {
        variable: string;
        type: "string" | "number" | "boolean" | EntityType;
        value: string | number | boolean;
    };
}

/**
 * `compendium` is a collection of `Prop` templates used  to create `item` instances.
 */
let compendium: Record<string, Prop> = {
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
                desctructible: false,
                description: "${doorSign}. The door is open.",
                variant: "default",
            },
            closed: {
                traversable: 0,
                desctructible: false,
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
                desctructible: false,
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
    const state = compendium[item.prop].states[item.state];
    const variables = JSON.parse(item.variables);
    // Replace variables in description
    state.description = substituteVariables(state.description, variables);
    return state;
}
