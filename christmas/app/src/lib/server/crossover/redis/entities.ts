import type { LocationType } from "$lib/crossover/world/types";
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

interface EntityState {
    loc: string[];
    locT: LocationType;
    lvl: number;
    ap: number; // action points (require to perform abilities)
    hp: number; // health points
    mp: number; // mana points
    st: number; // stamina points
    apclk: number; // time the last action points was used
    buclk: number; // busy clock (time the entity is busy till)
    dbuf: string[];
    buf: string[];
}

/*
 * Player
 */

const PlayerEntitySchema = new Schema("Player", {
    // Player metadata
    player: { type: "string" },
    name: { type: "string" },
    avatar: { type: "string" },
    rgn: { type: "string" }, // region
    lgn: { type: "boolean" }, // logged in
    lum: { type: "number" }, // lumina
    umb: { type: "number" }, // umbra
    // EntityState
    loc: { type: "string[]" },
    locT: { type: "string" },
    lvl: { type: "number" },
    ap: { type: "number" }, // action points (require to perform abilities)
    hp: { type: "number" }, // health points
    mp: { type: "number" }, // mana points
    st: { type: "number" }, // stamina points
    apclk: { type: "number" }, // time the last action points was used
    buclk: { type: "number" }, //  busy clock (time the entity is busy till)
    dbuf: { type: "string[]" },
    buf: { type: "string[]" },
});

interface Player extends EntityState {
    player: string; // unique publicKey
    name: string;
    avatar: string;
    rgn: string;
    lgn: boolean;
    lum: number;
    umb: number;
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
    // EntityState
    loc: { type: "string[]" },
    locT: { type: "string" },
    lvl: { type: "number" },
    ap: { type: "number" }, // action points (require to perform abilities)
    hp: { type: "number" }, // health points
    mp: { type: "number" }, // mana points
    st: { type: "number" }, // stamina points
    apclk: { type: "number" }, // time the last action points was used
    buclk: { type: "number" }, //  busy clock (time the entity is busy till)
    dbuf: { type: "string[]" },
    buf: { type: "string[]" },
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
    own: { type: "string" }, // who owns or can use the item (player | monster | public (empty) | dm)
    cfg: { type: "string" }, // who can configure the item (player | monster | public (empty) | dm)
    cld: { type: "boolean" }, // collider
    // Item state
    loc: { type: "string[]" },
    locT: { type: "string" },
    dur: { type: "number" },
    chg: { type: "number" }, // charges
    dbuf: { type: "string[]" },
    buf: { type: "string[]" },
});

interface Item {
    // Item metadata
    item: string;
    name: string;
    prop: string;
    vars: Record<string, string | number | boolean>; // not searchable
    own: string;
    cfg: string; // config owner
    cld: boolean;
    // Item state
    loc: string[];
    locT: LocationType;
    dur: number;
    chg: number;
    state: string;
    dbuf: string[];
    buf: string[];
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
    loc: { type: "string[]" }, // geohashes of plots (whole grids less than unit precision)
    h: { type: "number" }, // height
    w: { type: "number" }, // width
    cld: { type: "string[]" }, // colliders
});

interface World {
    world: string;
    url: string;
    h: number;
    w: number;
    loc: string[];
    cld: string[];
}

type WorldEntity = World & Entity;
