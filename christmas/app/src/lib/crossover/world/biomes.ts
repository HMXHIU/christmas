import { PUBLIC_TOPOLOGY_ENDPOINT } from "$env/static/public";
import type { CacheInterface } from "$lib/caches";
import {
    geohashToColRow,
    seededRandom,
    stringToRandomNumber,
} from "$lib/crossover/utils";
import ngeohash from "ngeohash";
import { PNG, type PNGWithMetadata } from "pngjs";
import { type AssetMetadata, type WorldSeed } from ".";
import { biomes, worldSeed } from "./settings";
export {
    INTENSITY_TO_HEIGHT,
    biomeAtGeohash,
    biomesNearbyGeohash,
    heightAtGeohash,
    tileAtGeohash,
    topologyAtGeohash,
    topologyTile,
    type Biome,
    type Tile,
};

const INTENSITY_TO_HEIGHT = 8850 / 255;

interface Decoration {
    asset: AssetMetadata;
    minInstances: number;
    maxInstances: number;
    probability: number;
    radius: number; // in cells
}

interface Biome {
    biome: string;
    name: string;
    description: string;
    traversableSpeed: number; // 0.0 - 1.0
    asset?: AssetMetadata;
    decorations?: Record<string, Decoration>;
}

interface Tile {
    geohash: string;
    name: string;
    description: string;
}

function topologyTile(geohash: string): {
    url: string;
    topLeft: string;
    rows: number;
    cols: number;
    row: number;
    col: number;
} {
    // The topology is stored as 2 precision tiles (4 rows, 8 cols)
    const tile = geohash.slice(0, 2);
    let rows = 4;
    let cols = 8;
    let topLeft = tile;
    for (let i = 0; i < geohash.length - 2 - 1; i++) {
        if (i % 2 === 0) {
            rows *= 8;
            cols *= 4;
            topLeft += "b";
        } else {
            rows *= 4;
            cols *= 8;
            topLeft += "p";
        }
    }

    if (topLeft.slice(-1) === "b") {
        topLeft += "p";
    } else {
        topLeft += "b";
    }

    const [tlCol, tlRow] = geohashToColRow(topLeft);
    const [col, row] = geohashToColRow(geohash);

    return {
        url: `${PUBLIC_TOPOLOGY_ENDPOINT}/${tile}.png`,
        topLeft,
        rows,
        cols,
        col: col - tlCol,
        row: row - tlRow,
    };
}

async function topologyBuffer(
    url: string,
    options?: {
        responseCache?: CacheInterface;
        bufferCache?: CacheInterface;
    },
): Promise<PNGWithMetadata> {
    // Return cached buffer
    const buffer = await options?.bufferCache?.get(url);
    if (buffer) {
        return buffer;
    }

    // Fetch response from cache or network
    let cachedResponse = await options?.responseCache?.get(url);
    const response = cachedResponse?.clone() ?? (await fetch(url));
    if (cachedResponse == null && options?.responseCache != null) {
        options.responseCache.set(url, response.clone());
    }

    // Save buffer to cache
    var png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
    if (options?.bufferCache != null) {
        await options.bufferCache.set(url, png);
    }

    return png;
}

async function topologyAtGeohash(
    geohash: string,
    options?: {
        responseCache?: CacheInterface;
        bufferCache?: CacheInterface;
    },
): Promise<{
    intensity: number;
    width: number;
    height: number;
    x: number;
    y: number;
}> {
    const { rows, cols, url, row, col } = topologyTile(geohash);
    const png = await topologyBuffer(url, {
        responseCache: options?.responseCache,
        bufferCache: options?.bufferCache,
    });

    const { width, height, data } = png;
    const x = Math.round((width - 1) * (col / cols)); // x, y is 0 indexed
    const y = Math.round((height - 1) * (row / rows));
    const index = 4 * (y * width + x); // there is rgba channels for pngjs
    return {
        width,
        height,
        x,
        y,
        intensity: data[index],
    };
}

/**
 * Determines the height in meters at the given geohash based on the topology.
 *
 * @param geohash - The geohash coordinate string.
 * @returns The height at the given geohash.
 */
async function heightAtGeohash(
    geohash: string,
    options?: {
        responseCache?: CacheInterface;
        resultsCache?: CacheInterface;
        bufferCache?: CacheInterface;
    },
): Promise<number> {
    return (
        (await options?.resultsCache?.get(geohash)) ??
        Math.ceil(
            (
                await topologyAtGeohash(geohash, {
                    responseCache: options?.responseCache,
                    bufferCache: options?.bufferCache,
                })
            ).intensity * INTENSITY_TO_HEIGHT,
        )
    );
}

/**
 * Determines the biome name at the given geohash based on probabilities configured in the world seed.
 *
 * @param geohash - The geohash coordinate string
 * @param seed - Optional world seed to use. Defaults to globally set seed.
 * @returns The name of the biome and strength at that geohash.
 *
 * TODO: Add caching to avoid redundant calls to biomeAtGeohash().
 * TODO: Replace with simplex noise etc..
 *
 * |----(bio)----|
 * |----(bio)----||----(water)----|
 * |---dice---|   // bio, strength is taken from mid point 1 - (dice - bio/2) / bio/2
 * |-----------dice-----------|   // water, 1 - ((dice - bio) - water/2) / water/2
 */
async function biomeAtGeohash(
    geohash: string,
    options?: {
        seed?: WorldSeed;
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
        topologyResponseCache?: CacheInterface;
    },
): Promise<[string, number]> {
    const seed = options?.seed || worldSeed;

    // Leave h9* for ice for testing (fully traversable)
    if (geohash.startsWith("h9")) {
        return [biomes.ice.biome, 1];
    }

    // Get topology
    const height = await heightAtGeohash(geohash, {
        responseCache: options?.topologyResponseCache,
        resultsCache: options?.topologyResultCache,
        bufferCache: options?.topologyBufferCache,
    });

    // Below sea level
    if (height < 1) {
        return [biomes.water.biome, 1];
    }

    const continent = geohash.charAt(0);
    const probBio = seed.seeds.continent[continent].bio;
    const probWater = seed.seeds.continent[continent].water;
    const totalProb = probBio + probWater;

    // Use the geohash as the random seed (must be reproducible)
    const rv = seededRandom(stringToRandomNumber(geohash)) * totalProb;

    // Select biome
    if (rv < probBio) {
        const bioMid = probBio / 2;
        return [biomes.forest.biome, 1 - Math.abs(rv - bioMid) / bioMid];
    }
    if (rv < probBio + probWater) {
        const rvv = rv - probBio;
        const waterMid = probWater / 2;
        return [biomes.water.biome, 1 - Math.abs(rvv - waterMid) / waterMid];
    }
    return [biomes.plains.biome, 1];
}

/**
 * Generates biomes in the vincinity of the given geohash by iterating
 * over all child geohashes at a precision 1 higher than the given geohash
 *
 * @param geohash - The geohash geohash to generate biomes for.
 * @param seed - Optional world seed.
 * @returns A record of geohash to biomes generated with biomeAtGeohash().
 */
async function biomesNearbyGeohash(
    geohash: string,
    options?: {
        seed?: WorldSeed;
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
        topologyResponseCache?: CacheInterface;
    },
): Promise<Record<string, string>> {
    const seed = options?.seed || worldSeed;
    const [minlat, minlon, maxlat, maxlon] = ngeohash.decode_bbox(geohash);

    // Get all the geohashes 1 precision higher than the geohash
    const geohashes = ngeohash.bboxes(
        minlat,
        minlon,
        maxlat,
        maxlon,
        geohash.length + 1,
    );

    return Object.fromEntries(
        await Promise.all(
            geohashes.map(async (geohash) => {
                const [biome, _] = await biomeAtGeohash(geohash, {
                    seed,
                    topologyResponseCache: options?.topologyResponseCache,
                    topologyResultCache: options?.topologyResultCache,
                    topologyBufferCache: options?.topologyBufferCache,
                });
                return [geohash, biome];
            }),
        ),
    );
}

/**
 * Retrieves the tile information based on the given geohash and biome.
 *
 * @param geohash - The geohash representing the location of the tile.
 * @param biome - The biome of the tile.
 * @returns The tile information including geohash, name, and description.
 */
function tileAtGeohash(geohash: string, biome: string): Tile {
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
