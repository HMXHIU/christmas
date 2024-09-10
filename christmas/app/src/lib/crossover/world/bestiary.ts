import { PUBLIC_HOST } from "$env/static/public";
import type { Monster } from "$lib/server/crossover/redis/entities";
import { seededRandom, stringToRandomNumber } from "$lib/utils";
import { entityLevel } from "./entity";
import { bestiary } from "./settings/bestiary";
import { worldSeed } from "./settings/world";
import type { SkillLines } from "./skills";
import type { AssetMetadata, Currency } from "./types";
import { type WorldSeed } from "./world";

export {
    avatarMorphologies,
    monsterLimitAtGeohash,
    monsterLUReward,
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
    skillLines: Partial<Record<SkillLines, number>>;
    alignment: Alignment;
    asset: AssetMetadata;
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

    // TODO: deprecate this

    // Every precision down divides by 32 the number of monsters
    const maxMonsters =
        seed.constants.maxMonstersPerContinent / 32 ** (geohash.length - 1);

    // Use the geohash as the random seed (must be reproducible)
    const rv = seededRandom(stringToRandomNumber(geohash));

    return Math.ceil(rv * maxMonsters);
}

function monsterLUReward(monster: Monster): Record<Currency, number> {
    const { alignment } = bestiary[monster.beast];
    const level = entityLevel(monster);

    // TODO: Calculate reward using attributes, skills, etc...

    if (alignment === "evil") {
        return {
            lum: Math.ceil(level),
            umb: 0,
        };
    }
    return {
        lum: Math.ceil(level),
        umb: 0,
    };
}
