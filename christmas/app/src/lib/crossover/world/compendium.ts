import type { EntityType, Item } from "$lib/server/crossover/redis/entities";
import { substituteVariables } from "$lib/utils";
import lodash from "lodash";
import { type AssetMetadata } from ".";
import { compendium } from "./settings";
const { cloneDeep } = lodash;

export {
    EquipmentSlots,
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
        item.variables,
    ) as string;
    return state;
}
