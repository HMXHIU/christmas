import type { AssetMetadata } from ".";

export { bestiary, type Beast };

/**
 * `Beast` is a template used to spawn a `Monster` with derived stats from the template.
 */
interface Beast {
    beast: string;
    description: string;
    attack: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    defense: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    health: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    speed: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    rarity: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
    abilities: string[];
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
        rarity: 1,
        abilities: ["steal"],
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
        rarity: 1,
        abilities: ["paralyze"],
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
        rarity: 10,
        abilities: ["breathFire"],
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
