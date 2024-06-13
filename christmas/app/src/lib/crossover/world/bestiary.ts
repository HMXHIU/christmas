import { seededRandom, stringToRandomNumber } from "../utils";
import { abilities, type AbilityType } from "./abilities";
import type { AssetMetadata } from "./types";
import { worldSeed, type WorldSeed } from "./world";

export {
    bestiary,
    monsterLUReward,
    monsterLimitAtGeohash,
    monsterStats,
    type Alignment,
    type Beast,
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
        alignment: "evil",
        spawnRate: 1,
        spawnBiomes: [],
        spawnHostileThreshold: 0.1,
        asset: {
            path: "bestiary/goblin",
            // animations: {
            //     stand: "stand",
            // },
            // variants: {
            //     default: "stand/0",
            // },
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
        alignment: "neutral",
        spawnRate: 1,
        spawnBiomes: [],
        spawnHostileThreshold: 0.1,
        asset: {
            path: "bestiary/goblin",
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
        alignment: "evil",
        spawnRate: 10,
        spawnBiomes: [],
        spawnHostileThreshold: 0.5,
        asset: {
            path: "bestiary/goblin",
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

type Alignment = "good" | "neutral" | "evil";

/**
 * `Beast` is a template used to spawn a `Monster` with derived stats from the template.
 */
interface Beast {
    beast: string;
    description: string;
    attack: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    defense: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    health: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    magic: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    endurance: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    speed: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    rarity: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    abilities: Record<AbilityType, string[]>;
    behaviours: string[];
    alignment: Alignment;
    spawnRate: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    spawnBiomes: string[];
    spawnHostileThreshold: number;
    asset: AssetMetadata;
}

function monsterStats({ level, beast }: { level: number; beast: string }): {
    hp: number;
    mp: number;
    st: number;
    ap: number;
} {
    const beastTemplate = bestiary[beast];
    const multiplier = 1 + Math.log(level) + level; // make monsters stronger than players
    return {
        hp: Math.ceil(beastTemplate.health * 10 * multiplier),
        mp: Math.ceil(beastTemplate.magic * 10 * multiplier),
        st: Math.ceil(beastTemplate.endurance * 10 * multiplier),
        ap: Math.ceil(beastTemplate.speed + 10),
    };
}

/**
 * Calculates the monster limit at a given geohash location based on the world seed.
 *
 * @param geohash - The geohash location.
 * @param seed - The world seed (optional). If not provided, the default world seed will be used.
 * @returns The calculated monster limit at the geohash location.
 */
function monsterLimitAtGeohash(geohash: string, seed?: WorldSeed): number {
    seed = seed || worldSeed;
    const continent = geohash.charAt(0);
    const probHostile = seed.seeds.continent[continent].bio;

    // Every precision down divides by 32 the number of monsters
    const maxMonsters =
        (seed.constants.maxMonstersPerContinent * probHostile) /
        32 ** (geohash.length - 1);

    // Use the geohash as the random seed (must be reproducible)
    const rv = seededRandom(stringToRandomNumber(geohash));

    return Math.ceil(rv * maxMonsters);
}

function monsterLUReward({ level, beast }: { level: number; beast: string }): {
    lumina: number;
    umbra: number;
} {
    const { rarity, alignment } = bestiary[beast];
    if (alignment === "evil") {
        return {
            lumina: Math.ceil(level * rarity),
            umbra: 0,
        };
    }
    return {
        lumina: Math.ceil(level * rarity),
        umbra: 0,
    };
}
