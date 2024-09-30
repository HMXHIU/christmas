import type {
    DieRoll,
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/crossover/types";
import { substituteVariablesRecursively } from "$lib/utils";
import { getEntityId } from "../utils";
import type { Abilities } from "./abilities";
import type { Actions } from "./actions";
import { compendium } from "./settings/compendium";
import {
    EquipmentSlots,
    WeaponSlots,
    type AssetMetadata,
    type EquipmentSlot,
    type GeohashLocation,
} from "./types";

export {
    isItemEquipped,
    isWeaponEquipped,
    itemAttibutes,
    type EquipmentAsset,
    type ItemVariables,
    type Prop,
    type PropAttributes,
    type PropVariables,
    type PropWorld,
    type Utility,
};

interface PropWorld {
    locationInstance: string; // variable substitutable to self.item
    locationType: GeohashLocation;
    geohash: string; // location to spawn world (variable substitutable to self.loc[0])
    world: string; // id (variable substitutable to self.item)
    url: string; // url to world tilemap
}

/**
 * `Prop` is a template used to create an `item` instance
 */
interface Prop {
    prop: string;
    asset: AssetMetadata;
    durability: number;
    charges: number;
    states: PropStates; // map item.state to prop attributes
    utilities: Record<string, Utility>;
    variables: PropVariables; // configurable variables to alter prop behavior & descriptions
    weight: number; // -1 means it cannot be taken
    collider: boolean; // cannot have more than 1 collidable item in the same location, cannot walk through collidable items
    dieRoll?: DieRoll; // weapon damage + modifier used for both attack rolls & saving throws (use the max of)
    equipmentSlot?: EquipmentSlot[]; // can be used to tell if item is an equipment
    equipmentAssets?: Record<string, EquipmentAsset>; // maps bone to EquipmentAsset
    // Spawn a world (lazily) related to this instance (eg. tavern, interior)
    world?: PropWorld;
}

type PropStates = {
    default: PropAttributes; // must minimally implement the default state
} & Record<string, PropAttributes>;

interface PropAttributes {
    name: string; // the default state name is used as the item.name during creation
    description: string;
    destructible: boolean;
    variant: string;
}

interface EquipmentAsset {
    asset?: AssetMetadata;
    tint?: Float32Array; // tints the texture (eg. under armour)
    replace?: boolean; // replace the texture (defaults to overlay)
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
    range?: number; // if not an ability or action (eg. open door), then it will check the range provided
    // abilities[ability] `self` and `target` will be provided when `useItem` is called but can be overwritten via `variables`
    ability?: Abilities;
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
    return substituteVariablesRecursively(
        compendium[item.prop].states[item.state],
        itemVariables(item),
    );
}

function itemVariables(item: Item): ItemVariables {
    const vars: ItemVariables = {};
    for (const { variable, value } of Object.values(
        compendium[item.prop].variables,
    )) {
        vars[variable] = item.vars[variable] ?? value;
    }
    return vars;
}

function isItemEquipped(item: Item, entity: Player | Monster | Item): boolean {
    return (
        EquipmentSlots.includes(item.locT as EquipmentSlot) &&
        item.loc[0] === getEntityId(entity)[0]
    );
}

function isWeaponEquipped(
    item: Item,
    entity: Player | Monster | Item,
): boolean {
    return (
        WeaponSlots.includes(item.locT as EquipmentSlot) &&
        item.loc[0] === getEntityId(entity)[0]
    );
}
