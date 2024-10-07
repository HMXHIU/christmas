import type { Beast } from "../bestiary";
import { worldSeed } from "./world";

export { bestiary };

/**
 * `bestiary` is a collection of `Beast` templates used to spawn `Monster` instances.
 */
const bestiary: Record<string, Beast> = {
    goblin: {
        beast: "goblin",
        description:
            "A small, resourceful green creature that loves to steal shiny things.",
        skills: {
            beast: 1,
            dirtyfighting: 1,
            monster: 1, // all monsters must have monster skill (which also is their level)
            firstaid: 1,
        },
        alignment: "evil",
        asset: {
            path: "bestiary/goblin",
            variants: {
                default: "stand/0",
                dead: "stand/0",
            },
        },
        trophies: {
            alchemist: ["blood"],
            blacksmith: ["teeth"],
            grocer: ["intestines"],
        },
    },
    giantSpider: {
        beast: "giantSpider",
        description: "A huge spider that can paralyze its prey.",
        skills: {
            arachnid: 3,
            monster: 1,
        },
        alignment: "neutral",
        asset: {
            path: "bestiary/goblin",
        },
        trophies: {
            alchemist: ["venom"],
            blacksmith: ["chitin"],
            grocer: ["legs"],
        },
    },
    dragon: {
        beast: "dragon",
        description: "A huge, fire-breathing lizard.",
        skills: {
            draconic: 8,
            monster: 1,
        },
        alignment: "evil",
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
        trophies: {
            alchemist: ["blood"],
            blacksmith: ["scales"],
            grocer: ["heart"],
        },
    },
};
