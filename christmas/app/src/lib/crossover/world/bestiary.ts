import { type AssetMetadata, type WorldSeed } from ".";
import { seededRandom, stringToRandomNumber } from "../utils";
import { type AbilityType } from "./abilities";
import { bestiary, worldSeed } from "./settings";

export { monsterLimitAtGeohash, monsterStats, type Beast };

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
