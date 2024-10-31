import type { Actor, DieRoll, EntityType, Item } from "$lib/crossover/types";
import { substituteVariablesRecursively } from "$lib/utils";
import { mapValues } from "lodash-es";
import { getEntityId, isEntityEquipment, isEntityWeapon } from "../utils";
import type { Abilities } from "./abilities";
import type { Actions } from "./actions";
import type { Condition } from "./combat";
import type { Attributes } from "./entity";
import { compendium } from "./settings/compendium";
import {
    type AssetMetadata,
    type EquipmentSlot,
    type GeohashLocation,
} from "./types";

export {
    defaultPropAttributes,
    isItemEquipped,
    isItemInInventory,
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
    uri: string; // url or urn to world tilemap (if urn, `GAME_TILEMAPS` is prefixed automatically)
}

/**
 * `Prop` is a template used to create an `item` instance
 */
interface Prop {
    prop: string;
    asset?: AssetMetadata; // items with no assets only appear in the MUD descriptor
    durability: number;
    charges: number;
    states: PropStates; // map item.state to prop attributes
    utilities: Record<string, Utility>;
    variables: PropVariables; // configurable variables to alter prop behavior & descriptions
    weight: number; // -1 means it cannot be taken
    collider: boolean; // cannot have more than 1 collidable item in the same location, cannot walk through collidable items
    dieRoll?: DieRoll; // weapon damage + modifier used for both attack rolls & saving throws (use the max of)
    equipment?: Equipment;
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

interface Equipment {
    slot: EquipmentSlot; // can be used to tell if item is an equipment
    slotSize?: number; // how many slots the equipment takes (eg. greatsword takes 2 hands, defaults to 1 if not specified)
    damageReduction?: { fixed?: number; percent?: number };
    conditions?: Condition[]; // equipment conditions should have turns = -1 (infinitely)
    attributes?: Partial<Attributes>;
    assets?: Record<string, EquipmentAsset>; // maps bone to EquipmentAsset
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
    requireEquipped?: boolean; // defaults to false/undefined
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

function defaultPropAttributes(prop: string): PropAttributes {
    return substituteVariablesRecursively(
        compendium[prop].states["default"],
        mapValues(compendium[prop].variables, (v) => v.value),
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

function isItemEquipped(item: Item, entity: Actor): boolean {
    return isEntityEquipment(item) && item.loc[0] === getEntityId(entity)[0];
}

function isItemInInventory(item: Item, entity: Actor): boolean {
    return item.locT === "inv" && item.loc[0] === getEntityId(entity)[0];
}

function isWeaponEquipped(item: Item, entity: Actor): boolean {
    return isEntityWeapon(item) && item.loc[0] === getEntityId(entity)[0];
}
