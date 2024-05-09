import type { LocationType } from "$lib/crossover/world";
import { Schema, type Entity } from "redis-om";

export {
    ItemEntitySchema,
    MonsterEntitySchema,
    PlayerEntitySchema,
    WorldEntitySchema,
    type EntityState,
    type EntityType,
    type GameEntity,
    type Item,
    type ItemEntity,
    type Monster,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
    type World,
    type WorldEntity,
};

type EntityType = "player" | "monster" | "item";
type GameEntity = Monster | Player | Item;

// TODO: change to `loc` `locT` `dbuf` `buf`, 'lvl' for lower memory usage
interface EntityState {
    location: string[];
    locationType: LocationType;
    level: number;
    ap: number; // action points (require to perform abilities)
    apclk: number; // time the last action points was used
    buclk: number; // busy clock (time the entity is busy till)
    hp: number; // health points
    mp: number; // mana points
    st: number; // stamina points
    debuffs: string[];
    buffs: string[];
}

/*
 * Player
 */

// TODO: change to `desc` for lower memory usage

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
    apclk: { type: "number" }, // time the last action points was used
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
    apclk: { type: "number" }, // time the last action points was used
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

const ItemEntitySchema = new Schema("Item", {
    // Item metadata
    item: { type: "string" },
    name: { type: "string" },
    prop: { type: "string" },
    owner: { type: "string" }, // who owns or can use the item (player | monster | public (empty) | dm)
    configOwner: { type: "string" }, // who can configure the item (player | monster | public (empty) | dm)
    collider: { type: "boolean" },
    // Item state
    location: { type: "string[]" },
    locationType: { type: "string" },
    durability: { type: "number" },
    charges: { type: "number" },
    debuffs: { type: "string[]" },
    buffs: { type: "string[]" },
});

interface Item {
    // Item metadata
    item: string;
    name: string;
    prop: string;
    variables: Record<string, string | number | boolean>; // not searchable
    owner: string;
    configOwner: string;
    collider: boolean;
    // Item state
    location: string[];
    locationType: LocationType;
    durability: number;
    charges: number;
    state: string;
    debuffs: string[];
    buffs: string[];
}

type ItemEntity = Item & Entity;

/*
 * World
 *
 * World entity is created from a tiled map (JSON format).
 */

const WorldEntitySchema = new Schema("World", {
    world: { type: "string" },
    url: { type: "string" },
    loc: { type: "string[]" },
    h: { type: "number" }, // height
    w: { type: "number" }, // width
    cdrs: { type: "string[]" }, // colliders
});

interface World {
    world: string;
    url: string;
    h: number;
    w: number;
    loc: string[];
    cdrs: string[];
}

type WorldEntity = World & Entity;
