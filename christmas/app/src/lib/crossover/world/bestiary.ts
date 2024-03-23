import type { AssetMetadata } from ".";
import { abilities, type AbilityType } from "./abilities";

export { bestiary, monsterStats, type Beast };

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

/**
 * `bestiary` is a collection of `Beast` templates used th spawn `Monster` instances.
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
        },
    },
};

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
