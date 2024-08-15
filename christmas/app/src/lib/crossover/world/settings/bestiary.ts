import type { Beast } from "../bestiary";
import { abilities } from "./abilities";
import { worldSeed } from "./world";

export { bestiary };

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
