import { PUBLIC_HOST } from "$env/static/public";
import type { EntityStats } from "$lib/server/crossover/redis/entities";
import { seededRandom, stringToRandomNumber } from "../utils";
import { type AbilityType } from "./abilities";
import { bestiary } from "./settings/bestiary";
import { worldSeed } from "./settings/world";
import type { AssetMetadata } from "./types";
import { type WorldSeed } from "./world";

export {
    avatarMorphologies,
    monsterLimitAtGeohash,
    monsterLUReward,
    monsterStats,
    type Alignment,
    type AvatarMorphology,
    type Beast,
};

type AvatarMorphology = "humanoid" | "canine";
const avatarMorphologies: Record<
    AvatarMorphology,
    { avatar: string; animation: string }
> = {
    humanoid: {
        avatar: `${PUBLIC_HOST}/avatar/humanoid.json`,
        animation: `${PUBLIC_HOST}/avatar/humanoid_animation.json`,
    },
    canine: {
        avatar: `${PUBLIC_HOST}/avatar/canine.json`,
        animation: `${PUBLIC_HOST}/avatar/canine.json`,
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

function monsterStats({
    level,
    beast,
}: {
    level: number;
    beast: string;
}): EntityStats {
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
