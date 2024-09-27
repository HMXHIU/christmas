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
import type { DamageType } from "./world/abilities";
import type { Attribute } from "./world/entity";

export type {
    BodyPart,
    Currency,
    CurrencyParams,
    Dialogue,
    DialogueEffect,
    Dialogues,
    DialogueTrigger,
    DieRoll,
    DropEffect,
    Effect,
    Effects,
    EntityState,
    EntityStats,
    EntityType,
    GameEntity,
    GiveTrigger,
    Item,
    KillTrigger,
    Monster,
    Objective,
    PathParams,
    Player,
    Quest,
    Reward,
    Stat,
    Trigger,
    Triggers,
    World,
};

type BodyPart = "head" | "torso" | "legs" | "arms";
type Stat = "hp" | "mnd" | "cha";
type Currency = "lum" | "umb";

interface DieRoll {
    count: number;
    sides: number;
    modifiers?: Attribute[];
    damageType?: DamageType;
}

type EntityType = "player" | "monster" | "item";
type GameEntity = Monster | Player | Item;

type EntityStats = Record<Stat, number>;
type CurrencyParams = Record<Currency, number>;

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

interface EntityState
    extends EntityStats,
        PathParams,
        LocationParams,
        CurrencyParams {
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

interface Player extends EntityState, CharacterParams {
    player: string; // publicKey
    avatar: string; // url to animation & avatar
    name: string;
    rgn: string;
    lgn: boolean;
    npc?: string; // npc instance id (if player is an NPC)
}

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

/**
 * Quests
 */

interface Quest {
    template: string;
    quest: string;
    entityIds: string[];
    fulfilled: boolean;
    // Unsearchable
    name: string;
    description: string;
    objectives: Objective[];
    reward?: Reward;
}

/**
 * Objective
 */

interface Objective {
    description: string;
    trigger: Trigger;
    effect: Effect;
    fulfilled: boolean;
    reward?: Reward;
}

/**
 * Reward
 */

interface Reward {
    lum?: number;
    umb?: number;
    items?: string[];
    props?: string[];
}

/**
 * Trigger
 */

type Trigger = KillTrigger | GiveTrigger | DialogueTrigger;
type Triggers = "kill" | "give" | "dialogue";

interface BaseTrigger {
    type: Triggers;
}

interface KillTrigger extends BaseTrigger {
    type: "kill";
    entity: string;
}

interface GiveTrigger extends BaseTrigger {
    type: "give";
    give: string;
    to: string;
}

interface DialogueTrigger extends BaseTrigger {
    type: "dialogue";
    with: string;
    dialogue: string;
}

/**
 * Effect
 */

type Effects = "drop" | "dialogue";
type Effect = DropEffect | DialogueEffect;

interface BaseEffect {
    type: Effects;
}

interface DropEffect extends BaseEffect {
    type: "drop";
    item: string;
}

interface DialogueEffect extends BaseEffect {
    type: "dialogue";
    dialogue: string;
}
