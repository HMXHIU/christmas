import { Schema, type Entity } from "redis-om";

export {
    ItemEntitySchema,
    MonsterEntitySchema,
    PlayerEntitySchema,
    type EntityState,
    type EntityType,
    type EquipmentSlot,
    type Item,
    type ItemEntity,
    type LocationType,
    type Monster,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
};

type EntityType = "player" | "monster" | "item";

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

type LocationType =
    | "geohash"
    | "item"
    | "inv" // inventory
    | EquipmentSlot;

interface EntityState {
    location: string[];
    locationType: LocationType;
    level: number;
    ap: number; // action points (require to perform abilities)
    hp: number; // health points
    mp: number; // mana points
    st: number; // stamina points
    debuffs: string[];
    buffs: string[];
}

/*
 * Player
 */

// Combines both `PlayerState` and `PlayerMetadata`
const PlayerEntitySchema = new Schema("Player", {
    // Player metadata
    player: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    // Player state
    location: { type: "string[]" },
    locationType: { type: "string" },
    loggedIn: { type: "boolean" },
    level: { type: "number" },
    ap: { type: "number" }, // action points (require to perform abilities)
    hp: { type: "number" }, // health points
    mp: { type: "number" }, // mana points
    st: { type: "number" }, // stamina points
    debuffs: { type: "string[]" },
    buffs: { type: "string[]" },
});

interface Player extends EntityState {
    // Player metadata
    player: string;
    name: string;
    description: string;
    // Player state
    loggedIn: boolean;
}

type PlayerEntity = Player & Entity;

/*
 * Monster
 *
 * A monster is the actual instance spawned using a `Beast` template in the bestiary.
 */

const MonsterEntitySchema = new Schema("Monster", {
    // Monster metadata
    monster: { type: "string" },
    name: { type: "string" },
    beast: { type: "string" },
    // Monster state
    location: { type: "string[]" },
    locationType: { type: "string" },
    level: { type: "number" },
    ap: { type: "number" }, // action points (require to perform abilities)
    hp: { type: "number" }, // health points
    mp: { type: "number" }, // mana points
    st: { type: "number" }, // stamina points
    debuffs: { type: "string[]" },
    buffs: { type: "string[]" },
});

interface Monster extends EntityState {
    // Monster metadata
    monster: string; // unique instance id
    name: string;
    beast: string;
}

type MonsterEntity = Monster & Entity;

/*
 * Item
 *
 * An item is the actual created instance using a `Prop` template in the compendium.
 */

interface ItemState {
    location: string[];
    locationType: LocationType;
    durability: number;
    charges: number;
    state: string;
    debuffs: string[];
    buffs: string[];
}

const ItemEntitySchema = new Schema("Item", {
    // Item metadata
    item: { type: "string" },
    name: { type: "string" },
    prop: { type: "string" },
    variables: { type: "string" }, // JSON string non searchable
    owner: { type: "string" }, // who owns or can use the item (player | monster | public (empty) | dm)
    configOwner: { type: "string" }, // who can configure the item (player | monster | public (empty) | dm)
    // Item state
    location: { type: "string[]" },
    locationType: { type: "string" },
    durability: { type: "number" },
    charges: { type: "number" },
    debuffs: { type: "string[]" },
    buffs: { type: "string[]" },
});

interface Item extends ItemState {
    // Item metadata
    item: string; // unique instance id
    name: string;
    prop: string;
    variables: string;
}

type ItemEntity = Item & Entity;
