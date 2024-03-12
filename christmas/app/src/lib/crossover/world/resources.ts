import knight from "$lib/crossover/world/sprites/tinysword/Factions/Knights/Troops/Warrior/Yellow/Warrior_Yellow.png";
import tree from "$lib/crossover/world/sprites/tinysword/Resources/Trees/Tree.png";
import water from "$lib/crossover/world/sprites/tinysword/Terrain/Water/Water.png";

import type { TileSchema } from "$lib/server/crossover/router";
import type { z } from "zod";

export { abyssTile, biomes, loadResources, type Resources };

const abyssTile: z.infer<typeof TileSchema> = {
    name: "The Abyss",
    tile: "59ke577h",
    description: "You are nowhere to be found.",
};

interface ResourceEntry {
    name: string;
    src: string;
    image?: HTMLImageElement;
    isLoaded?: boolean;
    bbox?: [number, number, number, number];
}

type Resource = Record<string, ResourceEntry>;

interface Resources {
    biomes: Resource;
    avatars: Resource;
}

let biomes: Resource = {
    desert: { name: "desert", src: "" },
    forest: {
        name: "forest",
        src: tree,
        bbox: [0, 0, 200, 200],
    },
    grassland: { name: "grassland", src: "" },
    hills: { name: "hills", src: "" },
    mountains: { name: "mountains", src: "" },
    plains: { name: "plains", src: "" },
    swamp: { name: "swamp", src: "" },
    tundra: { name: "tundra", src: "" },
    water: {
        name: "water",
        src: water,
        bbox: [0, 0, 64, 64],
    },
    wetlands: { name: "wetlands", src: "" },
};

let avatars: Resource = {
    knight: {
        name: "knight",
        src: knight,
        bbox: [0, 0, 200, 200],
    },
};

async function loadResources(): Promise<Resources> {
    async function load(resource: Resource) {
        return Promise.all(
            Object.entries(resource).map(([key, biome]) => {
                return new Promise((resolve, reject) => {
                    if (biome.src) {
                        const img = new Image();
                        img.onload = () => {
                            biome.isLoaded = true;
                            biome.image = img;
                            resolve([key, biome]);
                        };
                        img.onerror = reject;
                        img.src = biome.src;
                    } else {
                        resolve([key, biome]);
                    }
                });
            }),
        ).then((results: any) => {
            return Object.fromEntries(results);
        });
    }

    return {
        biomes: await load(biomes),
        avatars: await load(avatars),
    };
}
