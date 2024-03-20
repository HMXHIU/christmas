import type { Monster } from "$lib/server/crossover/redis/entities";
import type { TileSchema } from "$lib/server/crossover/router";
import ngeohash from "ngeohash";
import type { z } from "zod";
import { biomes } from "./biomes";

export {
    abyssTile,
    biomeAtGeohash,
    biomesAtGeohash,
    childrenGeohashes,
    directionToVector,
    geohashNeighbour,
    geohashToCell,
    loadMoreGrid,
    monsterLimitAtGeohash,
    tileAtGeohash,
    uninhabitedNeighbouringGeohashes,
    updateGrid,
    worldSeed,
    type AssetMetadata,
    type Direction,
    type Grid,
    type WorldSeed,
};

const abyssTile: z.infer<typeof TileSchema> = {
    name: "The Abyss",
    geohash: "59ke577h",
    description: "You are nowhere to be found.",
};

interface AssetMetadata {
    bundle: string;
    name: string;
    animations?: Record<string, string>;
    variants?: Record<string, string>;
}

type Direction = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "u" | "d";

interface GridEntry {
    biome?: string; // can be procedurally generated at client
    monsters?: Record<string, Monster>; // needs to be fetched from server (spawned by dungeon master)
}
type Grid = Record<number, Record<number, Record<number, GridEntry>>>;

interface WorldSeed {
    name: string;
    description: string;
    constants: {
        maxMonstersPerContinent: number;
    };
    spatial: {
        continent: {
            precision: number;
        };
        territory: {
            precision: number;
        };
        guild: {
            precision: number;
        };
        city: {
            precision: number;
        };
        town: {
            precision: number;
        };
        unit: {
            precision: number;
        };
    };
    seeds: {
        continent: {
            [key: string]: {
                bio: number;
                hostile: number;
                water: number;
            };
        };
    };
}

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

const gridSizeAtPrecision: Record<number, { rows: number; cols: number }> = {
    1: { rows: 4, cols: 8 },
    2: { rows: 4 * 8, cols: 8 * 4 },
    3: { rows: 4 * 8 * 4, cols: 8 * 4 * 8 },
    4: { rows: 4 * 8 * 4 * 8, cols: 8 * 4 * 8 * 4 },
    5: { rows: 4 * 8 * 4 * 8 * 4, cols: 8 * 4 * 8 * 4 * 8 },
    6: { rows: 4 * 8 * 4 * 8 * 4 * 8, cols: 8 * 4 * 8 * 4 * 8 * 4 },
    7: { rows: 4 * 8 * 4 * 8 * 4 * 8 * 4, cols: 8 * 4 * 8 * 4 * 8 * 4 * 8 },
    8: {
        rows: 4 * 8 * 4 * 8 * 4 * 8 * 4 * 8,
        cols: 8 * 4 * 8 * 4 * 8 * 4 * 8 * 4,
    },
    9: {
        rows: 4 * 8 * 4 * 8 * 4 * 8 * 4 * 8 * 4,
        cols: 8 * 4 * 8 * 4 * 8 * 4 * 8 * 4 * 8,
    },
};

/**
 * Converts a string (seed) to a random number.
 *
 * @param str - The string to convert.
 * @returns The random number generated from the string (seed).
 */
function stringToRandomNumber(str: string): number {
    var hash = 0;
    if (str.length === 0) return hash;
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char; // Bitwise left shift and subtraction
        hash &= hash; // Convert to 32bit integer
    }
    return Math.abs(hash); // Ensure positive number
}

/**
 * Generates a seeded random number between 0 and 1.
 *
 * @param seed - The seed value used to generate the random number.
 * @returns A random number between 0 (inclusive) and 1 (exclusive).
 */
function seededRandom(seed: number): number {
    var x = Math.sin(seed) * 10000; // how many decimal places
    return x - Math.floor(x);
}

/**
 * Retrieves the tile information based on the given geohash and biome.
 * @param geohash - The geohash representing the location of the tile.
 * @param biome - The biome of the tile.
 * @returns The tile information including geohash, name, and description.
 */
function tileAtGeohash(
    geohash: string,
    biome: string,
): z.infer<typeof TileSchema> {
    let description = "";

    switch (biome) {
        case "forest":
            description =
                "A dense collection of trees and vegetation, home to a variety of wildlife.";
            break;
        case "desert":
            description =
                "A dry, arid region with extreme temperatures, sparse vegetation, and limited wildlife.";
            break;
        case "tundra":
            description =
                "A cold, treeless area with a frozen subsoil, limited vegetation, and adapted wildlife.";
            break;
        case "grassland":
            description =
                "A region dominated by grasses, with few trees and a diverse range of wildlife.";
            break;
        case "wetland":
            description =
                "An area saturated with water, supporting aquatic plants and a rich biodiversity.";
            break;
        case "mountain":
            description =
                "A high elevation region with steep terrain, diverse ecosystems, and unique wildlife.";
            break;
        default:
            description = "Unknown biome";
            break;
    }
    return {
        geohash,
        name: geohash, // TODO: get name from POI
        description: description,
    };
}

/**
 * Determines the biome name at the given geohash based on probabilities configured in the world seed.
 *
 * @param geohash - The geohash coordinate string
 * @param seed - Optional world seed to use. Defaults to globally set seed.
 * @returns The name of the biome determined for that geohash.
 *
 * TODO: Add caching to avoid redundant calls to biomeAtGeohash().
 *
 */
function biomeAtGeohash(geohash: string, seed?: WorldSeed): string {
    seed = seed || worldSeed;
    const continent = geohash.charAt(0);
    const probBio = seed.seeds.continent[continent].bio;
    const probWater = seed.seeds.continent[continent].water;
    const totalProb = probBio + probWater;

    // Use the geohash as the random seed (must be reproducible)
    const rv = seededRandom(stringToRandomNumber(geohash)) * totalProb;

    // Select biome
    if (rv < probBio) {
        return biomes.forest.biome;
    }
    if (rv < probBio + probWater) {
        return biomes.water.biome;
    }
    return biomes.plains.biome;
}

/**
 * Generates biomes for all geohash at one precision higher than the provided geohash,
 * using the biomeAtGeohash() function.
 *
 * TODO: Add caching to avoid redundant calls to biomeAtGeohash().
 *
 * @param geohash - The geohash geohash to generate biomes for.
 * @param seed - Optional world seed.
 * @returns A record of geohashd to biomes generated with biomeAtGeohash().
 */
function biomesAtGeohash(
    geohash: string,
    seed?: WorldSeed,
): Record<string, string> {
    seed = seed || worldSeed;

    const [minlat, minlon, maxlat, maxlon] = ngeohash.decode_bbox(geohash);

    // Get all the geohashes 1 precision higher than the geohash
    const geohashes = ngeohash.bboxes(
        minlat,
        minlon,
        maxlat,
        maxlon,
        geohash.length + 1,
    );

    return geohashes.reduce((obj: any, geohash) => {
        obj[geohash] = biomeAtGeohash(geohash, seed);
        return obj;
    }, {});
}

/**
 * Updates the provided grid with biomes from the biomes record.
 * Iterates through the biomes record entries, gets the latitude/longitude for each geohash,
 * calculates the row/col in the grid based on the geohash precision, and sets the biome value.
 * Initializes grid cells if they don't already exist.
 *
 * @param grid - The grid to update with biomes.
 * @param biomes - Record of geohash strings to biome names.
 * @returns The updated grid.
 */
function updateGrid(grid: Grid, biomes: Record<string, string>) {
    // Update grid with biomes
    for (const [geohash, biome] of Object.entries(biomes)) {
        const precision = geohash.length;
        // latitude (-90 at south, 90 at north) and longitude (-180 at west, 180 at east)
        const { latitude, longitude } = ngeohash.decode(geohash);
        // -latitude because we want top left to be (0, 0)
        const row = Math.floor(
            ((-latitude + 90) / 180) * gridSizeAtPrecision[precision].rows,
        );
        const col = Math.floor(
            ((longitude + 180) / 360) * gridSizeAtPrecision[precision].cols,
        );

        // Initialize row/col if they don't exist yet.
        grid[precision] ??= {};
        grid[precision][row] ??= {};
        grid[precision][row][col] ??= {};

        // Update biome
        grid[precision][row][col].biome = biome;
    }

    // TODO: Update grid with POIs

    return grid;
}

/**
 * Gets the grid cell coordinates for a given geohash.
 *
 * @param geohash - The geohash string.
 * @returns An object with the precision, row and column for the geohash in the grid.
 */
function geohashToCell(geohash: string): {
    precision: number;
    row: number;
    col: number;
} {
    const precision = geohash.length;
    const { latitude, longitude } = ngeohash.decode(geohash);

    // -latitude because we want top left to be (0, 0)
    const row = Math.floor(
        ((-latitude + 90) / 180) * gridSizeAtPrecision[precision].rows,
    );
    const col = Math.floor(
        ((longitude + 180) / 360) * gridSizeAtPrecision[precision].cols,
    );

    return { precision, row, col };
}

/**
 * Gets the geohash neighbor in the given direction.
 *
 * @param geohash - The current geohash.
 * @param direction - The direction to get the neighbor geohash.
 * @returns The neighbor geohash in the given direction.
 */
function geohashNeighbour(geohash: string, direction: Direction): string {
    return ngeohash.neighbor(geohash, directionToVector(direction));
}

/**
 * Loads more grid data based on the given geohash and grid.
 * @param geohash - The current geohash to load more grid data for.
 * @param grid - The current grid data.
 * @returns The updated grid data.
 */
function loadMoreGrid(geohash: string, grid: Grid): Grid {
    const parentGeohash = geohash.slice(0, -1);
    const biomes = biomesAtGeohash(parentGeohash);
    grid = updateGrid(grid, biomes);

    // Get neighbor geohashes of parent
    ngeohash.neighbors(parentGeohash).forEach((neighborGeohash) => {
        // Update grid with biomes if not previously loaded
        const biomes = biomesAtGeohash(neighborGeohash);
        grid = updateGrid(grid, biomes);
    });

    return grid;
}

/**
 * Converts a direction to a vector.
 * @param direction - The direction to convert.
 * @returns The vector representation of the direction.
 * @throws {Error} If the direction is invalid.
 */
function directionToVector(direction: Direction): [number, number] {
    if (direction === "n") {
        return [1, 0];
    } else if (direction === "s") {
        return [-1, 0];
    } else if (direction === "e") {
        return [0, 1];
    } else if (direction === "w") {
        return [0, -1];
    } else if (direction === "ne") {
        return [1, 1];
    } else if (direction === "nw") {
        return [1, -1];
    } else if (direction === "se") {
        return [-1, 1];
    } else if (direction === "sw") {
        return [-1, -1];
    }
    throw new Error(`Invalid direction: ${direction}`);
}

/**
 * Retrieves the uninhabited neighboring geohashes for the given geohashes.
 * An uninhabited neighboring geohash is a geohash that is adjacent to the given geohashes
 * and does not exist in the set of given geohashes.
 *
 * @param geohashes - An array of geohashes.
 * @returns A promise that resolves to an array of uninhabited neighboring geohashes.
 */
async function uninhabitedNeighbouringGeohashes(
    geohashes: string[],
): Promise<string[]> {
    // Get all parent geohashes
    const parentGeohashes = new Set(geohashes);

    // Get all neighboring geohashes where there are no players
    const neighboringGeohashes = new Set<string>();
    for (const geohash of parentGeohashes) {
        for (const neighborGeohash of ngeohash.neighbors(geohash)) {
            if (!parentGeohashes.has(neighborGeohash)) {
                neighboringGeohashes.add(neighborGeohash);
            }
        }
    }
    return Array.from(neighboringGeohashes);
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

function childrenGeohashes(geohash: string): string[] {
    if (geohash.length < 1) {
        throw new Error("Geohash must be at least length 1");
    }

    if (geohash.length % 2 === 0) {
        return "bcfguvyz89destwx2367kmqr0145hjnp".split("").map((c) => {
            return geohash + c;
        });
    } else {
        return "prxznqwyjmtvhksu57eg46df139c028b".split("").map((c) => {
            return geohash + c;
        });
    }
}
