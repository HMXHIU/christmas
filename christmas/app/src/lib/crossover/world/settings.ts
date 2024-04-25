import { PUBLIC_ENVIRONMENT } from "$env/static/public";
import { type WorldSeed } from ".";
import type { Ability } from "./abilities";
import type { Beast } from "./bestiary";
import type { Biome } from "./biomes";
import type { Prop } from "./compendium";

export {
    MS_PER_TICK,
    TICKS_PER_TURN,
    abilities,
    bestiary,
    biomes,
    compendium,
    worldSeed,
};

const TICKS_PER_TURN = 4;
const MS_PER_TICK = PUBLIC_ENVIRONMENT === "development" ? 1000 : 2000;
// const MS_PER_TICK = 2000;

/**
 * `worldSeed` is a template used to generate a `World` instance.
 */
const worldSeed: WorldSeed = {
    name: "yggdrasil 01",
    description: "The beginning",
    spatial: {
        continent: {
            precision: 1, // geohash precision
        },
        territory: {
            precision: 2,
        },
        guild: {
            precision: 3,
        },
        city: {
            precision: 4,
        },
        town: {
            precision: 5,
        },
        unit: {
            precision: 8,
        },
    },
    constants: {
        maxMonstersPerContinent: 10000000000, // 10 billion
    },
    seeds: {
        continent: {
            b: { bio: 0.5, hostile: 0.2, water: 0.1 },
            c: { bio: 0.5, hostile: 0.2, water: 0.1 },
            f: { bio: 0.5, hostile: 0.2, water: 0.1 },
            g: { bio: 0.5, hostile: 0.2, water: 0.1 },
            u: { bio: 0.5, hostile: 0.2, water: 0.1 },
            v: { bio: 0.5, hostile: 0.2, water: 0.1 },
            y: { bio: 0.5, hostile: 0.2, water: 0.1 },
            z: { bio: 0.5, hostile: 0.2, water: 0.1 },
            "8": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "9": { bio: 0.5, hostile: 0.2, water: 0.1 },
            d: { bio: 0.5, hostile: 0.2, water: 0.1 },
            e: { bio: 0.5, hostile: 0.2, water: 0.1 },
            s: { bio: 0.5, hostile: 0.2, water: 0.1 },
            t: { bio: 0.5, hostile: 0.2, water: 0.1 },
            w: { bio: 0.5, hostile: 0.2, water: 0.1 },
            x: { bio: 0.5, hostile: 0.2, water: 0.1 },
            "2": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "3": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "6": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "7": { bio: 0.5, hostile: 0.2, water: 0.1 },
            k: { bio: 0.5, hostile: 0.2, water: 0.1 },
            m: { bio: 0.5, hostile: 0.2, water: 0.1 },
            q: { bio: 0.5, hostile: 0.2, water: 0.1 },
            r: { bio: 0.5, hostile: 0.2, water: 0.1 },
            "0": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "1": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "4": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "5": { bio: 0.5, hostile: 0.2, water: 0.1 },
            h: { bio: 0.5, hostile: 0.2, water: 0.1 },
            j: { bio: 0.5, hostile: 0.2, water: 0.1 },
            n: { bio: 0.5, hostile: 0.2, water: 0.1 },
            p: { bio: 0.5, hostile: 0.2, water: 0.1 },
        },
    },
};

/**
 * `abilities` is a collection of all the `Ability` available in the game.
 */
const abilities: Record<string, Ability> = {
    bandage: {
        ability: "bandage",
        type: "healing",
        description: "Bandages the player's wounds.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: -5, damageType: "healing" },
                    ticks: TICKS_PER_TURN,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 0,
        range: 0,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
    },
    scratch: {
        ability: "scratch",
        type: "offensive",
        description: "Scratches the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "slashing" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 1,
        st: 1,
        hp: 0,
        mp: 0,
        range: 0,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: false,
        },
    },
    swing: {
        ability: "swing",
        type: "offensive",
        description: "Swing at the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "blunt" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 1,
        st: 1,
        hp: 0,
        mp: 0,
        range: 0,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: false,
        },
    },
    doubleSlash: {
        ability: "doubleSlash",
        type: "offensive",
        description: "Slashes the player twice.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "slashing" },
                    ticks: TICKS_PER_TURN / 3,
                },
            ],
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "slashing" },
                    ticks: TICKS_PER_TURN / 3,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 0,
        range: 0,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: false,
        },
    },
    // Blinded target cannot be affected by genjutsu
    eyePoke: {
        ability: "eyePoke",
        type: "offensive",
        description: "Pokes the player's eyes, blinding them.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    debuffs: { debuff: "blinded", op: "push" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
            [
                "check",
                {
                    target: "target",
                    debuffs: { debuff: "blinded", op: "contains" },
                    ticks: 0,
                },
            ],
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "piercing" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 2,
        st: 2,
        hp: 0,
        mp: 0,
        range: 0,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
    },
    // TODO: Remove illusions (genjutsu) on target
    bite: {
        ability: "bite",
        type: "offensive",
        description: "Bites the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 1, damageType: "piercing" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 1,
        st: 1,
        hp: 0,
        mp: 0,
        range: 1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
    },
    breathFire: {
        ability: "breathFire",
        type: "offensive",
        description: "Breathes fire possibly burning the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    damage: { amount: 3, damageType: "fire" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
            [
                "check",
                {
                    target: "target",
                    debuffs: { debuff: "wet", op: "doesNotContain" },
                    ticks: 0,
                },
            ],
            [
                "action",
                {
                    target: "target",
                    debuffs: { debuff: "burning", op: "push" },
                    ticks: 0,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 2,
        range: 1,
        aoe: 1,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster", "item"],
            targetSelfAllowed: false,
        },
    },
    paralyze: {
        ability: "paralyze",
        type: "offensive",
        description: "Paralyzes the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    debuffs: { debuff: "paralyzed", op: "push" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 2,
        range: 0,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
    },
    blind: {
        ability: "blind",
        type: "offensive",
        description: "Blinds the player.",
        procedures: [
            [
                "action",
                {
                    target: "target",
                    debuffs: { debuff: "blinded", op: "push" },
                    ticks: TICKS_PER_TURN / 2,
                },
            ],
        ],
        ap: 2,
        st: 1,
        hp: 0,
        mp: 2,
        range: 0,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster"],
            targetSelfAllowed: true,
        },
    },
    teleport: {
        ability: "teleport",
        type: "neutral",
        description: "Teleport to the target location.",
        procedures: [
            [
                "action",
                {
                    target: "self",
                    states: {
                        state: "location",
                        value: "{{target.location}}", // {{}} for variable access
                        op: "change",
                    },
                    ticks: TICKS_PER_TURN,
                },
            ],
        ],
        ap: 4,
        st: 0,
        hp: 0,
        mp: 20,
        range: -1,
        aoe: 0,
        predicate: {
            self: ["player", "monster"],
            target: ["player", "monster", "item"],
            targetSelfAllowed: true,
        },
    },
};

/**
 * `biomes` is a collection of all the `Biome` available in the game.
 */
let biomes: Record<string, Biome> = {
    // forest: {
    //     biome: "forest",
    //     name: "Forest",
    //     description:
    //         "A dense collection of trees and vegetation, home to a variety of wildlife.",
    //     traversableSpeed: 0.8,
    //     asset: {
    //         bundle: "biomes",
    //         name: "tree",
    //         animations: {
    //             sway: "sway",
    //         },
    //         variants: {
    //             default: "sway/0",
    //             1: "sway/1",
    //             2: "sway/2",
    //             3: "sway/3",
    //             4: "sway/4",
    //             dead: "stump",
    //         },
    //         width: 1,
    //         height: 1,
    //         precision: worldSeed.spatial.unit.precision,
    //     },
    // },
    forest: {
        biome: "forest",
        name: "Forest",
        description:
            "A dense collection of trees and vegetation, home to a variety of wildlife.",
        traversableSpeed: 0.8,
        asset: {
            bundle: "biomes",
            name: "lightgrass",
            variants: {
                default: "lightgrass",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
    desert: {
        biome: "desert",
        name: "Desert",
        description:
            "A dry, arid region with extreme temperatures, sparse vegetation, and limited wildlife.",
        traversableSpeed: 1.0,
    },
    tundra: {
        biome: "tundra",
        name: "Tundra",
        description:
            "A cold, treeless area with a frozen subsoil, limited vegetation, and adapted wildlife.",
        traversableSpeed: 1.0,
    },
    grassland: {
        biome: "grassland",
        name: "Grassland",
        description:
            "A region dominated by grasses, with few trees and a diverse range of wildlife.",
        traversableSpeed: 1.0,
    },
    wetland: {
        biome: "wetland",
        name: "Wetland",
        description:
            "An area saturated with water, supporting aquatic plants and a rich biodiversity.",
        traversableSpeed: 0.5,
    },
    mountain: {
        biome: "mountain",
        name: "Mountain",
        description:
            "A high elevation region with steep terrain, diverse ecosystems, and unique wildlife.",
        traversableSpeed: 0,
    },
    hills: {
        biome: "hills",
        name: "Hills",
        description:
            "A region of elevated terrain, with a variety of wildlife.",
        traversableSpeed: 0.5,
    },
    plains: {
        biome: "plains",
        name: "Plains",
        description: "A large area of flat land, with a variety of wildlife.",
        traversableSpeed: 1.0,
    },
    swamp: {
        biome: "swamp",
        name: "Swamp",
        description:
            "A wetland area with a variety of vegetation, supporting a diverse range of wildlife.",
        traversableSpeed: 0.7,
    },
    water: {
        biome: "water",
        name: "Water",
        description: "A large body of water, with a variety of aquatic life.",
        traversableSpeed: 0,
        asset: {
            bundle: "biomes",
            name: "lightwater",
            variants: {
                default: "lightwater",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
    ice: {
        biome: "ice",
        name: "Ice",
        description:
            "A region covered in ice, with limited vegetation and wildlife.",
        traversableSpeed: 1.0,
    },
};

/**
 * `bestiary` is a collection of `Beast` templates used to spawn `Monster` instances.
 */
const bestiary: Record<string, Beast> = {
    goblin: {
        beast: "goblin",
        description:
            "A small, green creature that loves to steal shiny things.",
        attack: 1,
        defense: 1,
        health: 1,
        speed: 1,
        magic: 1,
        endurance: 1,
        rarity: 1,
        abilities: {
            offensive: [abilities.scratch.ability],
            healing: [abilities.bandage.ability],
            defensive: [],
            neutral: [],
        },
        behaviours: [],
        spawnRate: 1,
        spawnBiomes: [],
        spawnHostileThreshold: 0.1,
        asset: {
            bundle: "bestiary",
            name: "goblin",
            animations: {
                stand: "stand",
            },
            variants: {
                default: "stand/0",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
    giantSpider: {
        beast: "giantSpider",
        description: "A huge spider that can paralyze its prey.",
        attack: 2,
        defense: 1,
        health: 1,
        speed: 2,
        magic: 2,
        endurance: 1,
        rarity: 1,
        abilities: {
            offensive: [abilities.bite.ability, abilities.paralyze.ability],
            healing: [],
            defensive: [],
            neutral: [],
        },
        behaviours: [],
        spawnRate: 1,
        spawnBiomes: [],
        spawnHostileThreshold: 0.1,
        asset: {
            bundle: "bestiary",
            name: "goblin",
            animations: {
                stand: "stand",
            },
            variants: {
                default: "stand/0",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
    dragon: {
        beast: "dragon",
        description: "A huge, fire-breathing lizard.",
        attack: 10,
        defense: 10,
        health: 10,
        speed: 10,
        magic: 8,
        endurance: 8,
        rarity: 10,
        abilities: {
            offensive: [abilities.bite.ability, abilities.breathFire.ability],
            healing: [],
            defensive: [abilities.blind.ability],
            neutral: [],
        },
        behaviours: [],
        spawnRate: 10,
        spawnBiomes: [],
        spawnHostileThreshold: 0.5,
        asset: {
            bundle: "bestiary",
            name: "goblin",
            animations: {
                stand: "stand",
            },
            variants: {
                default: "stand/0",
            },
            width: 3,
            height: 3,
            precision: worldSeed.spatial.unit.precision,
        },
    },
};

/**
 * `compendium` is a collection of `Prop` templates used  to create `item` instances.
 */
let compendium: Record<string, Prop> = {
    woodenclub: {
        prop: "woodenclub",
        defaultName: "Wooden Club",
        asset: {
            bundle: "props",
            name: "weapons",
            variants: {
                default: "wooden-club",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
        durability: 100,
        charges: 0,
        weight: 3,
        collider: false,
        equipmentSlot: ["rh", "lh"],
        defaultState: "default",
        states: {
            default: {
                destructible: true,
                description: "A simple wooden club ${etching}.", // ${} for string substitution
                variant: "default",
            },
        },
        utilities: {
            swing: {
                utility: "swing",
                description: "Swing the club at a target.",
                cost: {
                    charges: 0,
                    durability: 1,
                },
                state: {
                    start: "default",
                    end: "default",
                },
                ability: abilities.swing.ability,
                requireEquipped: true,
            },
        },
        variables: {
            etching: {
                variable: "etching",
                type: "string",
                value: "Nothing etched on the club",
            },
        },
    },
    potionofhealth: {
        prop: "potionofhealth",
        defaultName: "Potion of Health",
        // TODO: Add potion asset
        asset: {
            bundle: "props",
            name: "potions",
            variants: {
                default: "red-potion",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
        durability: 100,
        charges: 5,
        weight: 1,
        collider: false,
        defaultState: "default",
        states: {
            default: {
                destructible: true,
                description:
                    "A bottle of clear crystal glass. You see a faint glowing red liquid inside.",
                variant: "default",
            },
        },
        utilities: {
            sip: {
                utility: "sip",
                description: "Sip the potion to restore health.",
                cost: {
                    charges: 1,
                    durability: 0,
                },
                state: {
                    start: "default",
                    end: "default",
                },
                ability: abilities.bandage.ability,
            },
        },
        variables: {},
    },
    woodendoor: {
        prop: "woodendoor",
        defaultName: "Wooden Door",
        asset: {
            bundle: "props",
            name: "gothic",
            variants: {
                default: "wood-door-2", // open
                closed: "wood-door-1",
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
        defaultState: "closed",
        durability: 100,
        charges: 0,
        weight: -1,
        collider: true,
        states: {
            open: {
                destructible: false,
                description: "${doorsign}. The door is open.",
                variant: "default",
            },
            closed: {
                destructible: false,
                description: "${doorsign}. The door is closed.",
                variant: "closed",
            },
        },
        utilities: {
            open: {
                utility: "open",
                description: "Open the door.",
                cost: {
                    charges: 0,
                    durability: 0,
                },
                state: {
                    start: "closed",
                    end: "open",
                },
            },
            close: {
                utility: "close",
                description: "Close the door.",
                cost: {
                    charges: 0,
                    durability: 0,
                },
                state: {
                    start: "open",
                    end: "closed",
                },
            },
        },
        variables: {
            doorsign: {
                variable: "doorsign",
                type: "string",
                value: "Just a plain wooden door",
            },
        },
    },
    tavern: {
        prop: "tavern",
        defaultName: "Tavern",
        // TODO: Add tavern asset
        asset: {
            bundle: "props",
            name: "gothic",
            variants: {
                default: "tavern",
            },
            width: 2,
            height: 2,
            precision: worldSeed.spatial.unit.precision,
        },
        defaultState: "default",
        durability: 100,
        charges: 0,
        weight: -1, // cannot be taken
        collider: true,
        states: {
            default: {
                destructible: false,
                description: "A humble tavern. ${description}",
                variant: "default",
            },
        },
        utilities: {},
        variables: {
            description: {
                variable: "description",
                type: "string",
                value: "A plain wooden door greets you.",
            },
        },
    },
    debris: {
        prop: "debris",
        defaultName: "Debris",
        asset: {
            bundle: "props",
            name: "gothic",
            variants: {
                default: "debris-9",
            },
            width: 2,
            height: 2,
            precision: worldSeed.spatial.unit.precision,
        },
        defaultState: "default",
        durability: 100,
        charges: 0,
        weight: -1, // cannot be taken
        collider: true,
        states: {
            default: {
                destructible: false,
                description: "Impassable debris",
                variant: "default",
            },
        },
        utilities: {},
        variables: {},
    },
    portal: {
        prop: "portal",
        defaultName: "Portal",
        asset: {
            bundle: "props",
            name: "gothic",
            variants: {
                default: "ritual-circle",
            },
            width: 2,
            height: 2,
            precision: worldSeed.spatial.unit.precision,
        },
        durability: 100,
        charges: 100,
        weight: -1,
        collider: false,
        defaultState: "default",
        states: {
            default: {
                destructible: false,
                description:
                    "${description}. It is tuned to teleport to ${target}.",
                variant: "default",
            },
        },
        variables: {
            // Can be used to overwrite `target` or `self` provided by `useItem`
            target: {
                variable: "target",
                type: "item", // portal's target is bound to an item to teleport to (another portal)
                value: "",
            },
            description: {
                variable: "description",
                type: "string",
                value: "A portal pulsing with magical energy",
            },
        },
        utilities: {
            teleport: {
                utility: "teleport",
                description: "Step through the portal.",
                cost: {
                    charges: 1,
                    durability: 0,
                },
                state: {
                    start: "default",
                    end: "default",
                },
                ability: abilities.teleport.ability,
            },
        },
    },
};
