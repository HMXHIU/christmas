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
import { type Entity } from "redis-om";
import type { DamageType } from "./world/abilities";
import type { Attribute } from "./world/entity";

export {
    type Dialogue,
    type DialogueEntity,
    type Dialogues,
    type DieRoll,
    type EntityState,
    type EntityStats,
    type EntityType,
    type GameEntity,
    type GameRedisEntities,
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

interface DieRoll {
    count: number;
    sides: number;
    modifiers?: Attribute[];
    damageTypes?: DamageType[];
}

type EntityType = "player" | "monster" | "item";
type GameEntity = Monster | Player | Item;
type GameRedisEntities = MonsterEntity | PlayerEntity | ItemEntity;

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

/**
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

/**
 * Monster
 *
 * Spawned from `beast` in the bestiary.
 */

interface Monster extends EntityState {
    // Monster
    monster: string; // `[beast]_[instance]`
    name: string;
    beast: string;
}

type MonsterEntity = Monster & Entity;

/**
 * Item
 *
 * Created from a `prop` in the compendium.
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

/**
 * World
 *
 * Created from a tiled map (JSON format)
 */
interface World {
    world: string;
    url: string;
    loc: string[];
    locT: GeohashLocationType;
}

type WorldEntity = World & Entity;

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

type DialogueEntity = Dialogue & Entity;
