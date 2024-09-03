import type {
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { substituteVariables } from "$lib/utils";
import { cloneDeep } from "lodash-es";
import { getEntityId } from "../utils";
import type { Actions } from "./actions";
import { compendium } from "./settings/compendium";
import {
    EquipmentSlots,
    type AssetMetadata,
    type EquipmentSlot,
    type GeohashLocationType,
} from "./types";

export {
    isItemEquipped,
    itemAttibutes,
    itemName,
    type EquipmentAsset,
    type ItemVariables,
    type Prop,
    type PropWorld,
    type Utility,
};

interface PropWorld {
    locationInstance: string; // variable substitutable to self.item
    locationType: GeohashLocationType;
    geohash: string; // location to spawn world (variable substitutable to self.loc[0])
    world: string; // id (variable substitutable to self.item)
    url: string; // url to world tilemap
}

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
    weight: number; // -1 means it cannot be taken
    collider: boolean; // cannot have more than 1 collidable item in the same location, cannot walk through collidable items
    equipmentSlot?: EquipmentSlot[]; // can be used to tell if item is an equipment
    equipmentAssets?: Record<string, EquipmentAsset>; // maps bone to EquipmentAsset
    // Spawn a world (lazily) related to this instance (eg. tavern, interior)
    world?: PropWorld;
}

interface EquipmentAsset {
    asset?: AssetMetadata;
    tint?: Float32Array; // tints the texture (eg. under armour)
    replace?: boolean; // replace the texture (defaults to overlay)
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
    action?: Actions;
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
        itemVariables(item),
    ) as string;
    return state;
}

/**
 * Helper to get the name of an item.
 * @param item - The item to get the name for.
 * @returns The name of the item.
 */
function itemName(item: Item): string {
    return item?.name || compendium[item.prop]?.defaultName;
}

/**
 * Helper to get the variables of an item.
 *
 * @param item - The item to get the variables for.
 * @returns The variables of the item.
 */
function itemVariables(item: Item): ItemVariables {
    const vars: ItemVariables = {};
    for (const { variable, value } of Object.values(
        compendium[item.prop].variables,
    )) {
        // If not exists, use the default from prop
        if (item.vars[variable] == null) {
            vars[variable] = value;
        }
        // Use var from item
        else {
            vars[variable] = item.vars[variable];
        }
    }
    return vars;
}

function isItemEquipped(item: Item, entity: Player | Monster | Item): boolean {
    return (
        EquipmentSlots.includes(item.locT as EquipmentSlot) &&
        item.loc[0] === getEntityId(entity)[0]
    );
}
