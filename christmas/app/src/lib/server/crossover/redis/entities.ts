import type {
    Archetypes,
    Genders,
    Races,
} from "$lib/crossover/world/demographic";
import type { SkillLines } from "$lib/crossover/world/skills";
import type {
    Direction,
    GeohashLocationType,
    LocationType,
} from "$lib/crossover/world/types";
import { Schema, type Entity } from "redis-om";

export {
    DialogueSchema,
    ItemEntitySchema,
    MonsterEntitySchema,
    PlayerEntitySchema,
    WorldEntitySchema,
    type Dialogue,
    type DialogueEntity,
    type Dialogues,
    type EntityState,
    type EntityStats,
    type EntityType,
    type GameEntity,
    type Item,
    type ItemEntity,
    type Monster,
    type MonsterEntity,
    type PathParams,
    type Player,
    type PlayerEntity,
    type World,
    type WorldEntity,
};

type EntityType = "player" | "monster" | "item";
type GameEntity = Monster | Player | Item;

interface EntityStats {
    hp: number;
    mp: number;
    st: number;
    ap: number;
    apclk: number; // needed for calculating current ap
}

interface PathParams {
    pthclk: number; // time the pth movement was started
    pthdur: number; // time duration for the pth movement to be completed
    pthst: string; // starting geohash of the path
    pth: Direction[]; // list of directions (nswe) of the path
}

interface LocationParams {
    loc: string[];
    locT: LocationType;
    locI: string; // location instance ("" for actual world)
}

interface EntityState extends EntityStats, PathParams, LocationParams {
    buclk: number; // busy clock (time the entity is busy till)
    dbuf: string[]; // debuffs
    buf: string[]; // buffs
    skills: SkillLevels; // skill levels
}

type SkillLevels = Partial<Record<SkillLines, number>>;

/*
 * Player
 */

interface CharacterParams {
    arch: Archetypes; // archetype
    gen: Genders; // gender
    race: Races;
}

interface CurrencyParams {
    lum: number;
    umb: number;
}

interface Player extends EntityState, CharacterParams, CurrencyParams {
    player: string; // publicKey
    avatar: string; // url to animation & avatar
    name: string;
    rgn: string;
    lgn: boolean;
    npc?: string; // npc instance id (if player is an NPC)
}

type PlayerEntity = Player & Entity;

// Only need to include searchable fields for redis schema
const PlayerEntitySchema = new Schema("Player", {
    // Player
    player: { type: "string" },
    name: { type: "string" },
    rgn: { type: "string" }, // region
    lgn: { type: "boolean" }, // logged in

    // Character
    arch: { type: "string" }, // archetype
    gen: { type: "string" }, // gender
    race: { type: "string" }, // race

    // Location
    loc: { type: "string[]" },
    locT: { type: "string" },
    locI: { type: "string" },

    // NPC
    npc: { type: "string" }, // npc instance id
});

/*
 * Monster
 *
 * A monster is spawned from `beast` in the bestiary.
 */

interface Monster extends EntityState {
    // Monster
    monster: string; // `[beast]_[instance]`
    name: string;
    beast: string;
}

type MonsterEntity = Monster & Entity;

// Only need to include searchable fields for redis schema
const MonsterEntitySchema = new Schema("Monster", {
    // Monster
    monster: { type: "string" },
    name: { type: "string" },
    beast: { type: "string" },

    // Location
    loc: { type: "string[]" },
    locT: { type: "string" },
    locI: { type: "string" },
});

/*
 * Item
 *
 * An item is created from a `prop` in the compendium.
 */

interface Item extends LocationParams {
    item: string; // `[prop]_[instance]`
    name: string;
    prop: string;
    vars: Record<string, string | number | boolean>; // variables
    own: string; // owner
    cfg: string; // config owner
    cld: boolean; // collider
    dur: number; // duration
    chg: number; // charges
    state: string;
    dbuf: string[];
    buf: string[];
}

type ItemEntity = Item & Entity;

// Only need to include searchable fields for redis schema
const ItemEntitySchema = new Schema("Item", {
    // Item
    item: { type: "string" },
    name: { type: "string" },
    prop: { type: "string" },
    own: { type: "string" }, // who owns or can use the item (player | monster | public (empty) | dm)
    cfg: { type: "string" }, // who can configure the item (player | monster | public (empty) | dm)
    cld: { type: "boolean" }, // collider

    // Location
    loc: { type: "string[]" },
    locT: { type: "string" },
    locI: { type: "string" },
});

/*
 * World
 *
 * World entity is created from a tiled map (JSON format).
 */

interface World {
    world: string;
    url: string;
    loc: string[];
    locT: GeohashLocationType;
}

type WorldEntity = World & Entity;

const WorldEntitySchema = new Schema("World", {
    world: { type: "string" },
    url: { type: "string" },
    locT: { type: "string" },
    loc: { type: "string[]" }, // geohashes of plots (whole grids less than unit precision)
});

/**
 * Dialogue
 */

type Dialogues = "grt" | "ign" | "agro";

interface Dialogue {
    msg: string; // message template (variable substituted before indexing)
    dia: Dialogues; // dialogue type
    tgt: string; // target to send the message to (empty = all)
    // Tags (variable substituted before indexing)
    mst?: string[]; // must contain all of these tags
    or?: string[]; // must match any these tags
    exc?: string[]; // must not contain these tags
}

const DialogueSchema = new Schema("Dialogue", {
    msg: { type: "string" },
    dia: { type: "string" },
    tgt: { type: "string" },
    // Tags
    mst: { type: "string[]" },
    or: { type: "string[]" },
    exc: { type: "string[]" },
});

type DialogueEntity = Dialogue & Entity;
