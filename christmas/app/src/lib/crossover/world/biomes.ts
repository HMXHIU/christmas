import { PUBLIC_TOPOLOGY_ENDPOINT } from "$env/static/public";
import type { CacheInterface } from "$lib/caches";
import {
    geohashToColRow,
    seededRandom,
    stringToRandomNumber,
} from "$lib/crossover/utils";
import ngeohash from "ngeohash";
import { PNG, type PNGWithMetadata } from "pngjs";
import { type AssetMetadata, type Tile } from "./types";
import { worldSeed, type WorldSeed } from "./world";
export {
    biomeAtGeohash,
    biomes,
    biomesNearbyGeohash,
    elevationAtGeohash,
    INTENSITY_TO_HEIGHT,
    tileAtGeohash,
    topologyAtGeohash,
    topologyTile,
    type Biome,
};

const INTENSITY_TO_HEIGHT = 8850 / 255;

/**
 * `biomes` is a collection of all the `Biome` available in the game.
 */
let biomes: Record<string, Biome> = {
    forest: {
        biome: "forest",
        name: "Forest",
        description:
            "A dense collection of trees and vegetation, home to a variety of wildlife.",
        traversableSpeed: 0.8,
        asset: {
            path: "biomes/terrain",
            variants: {
                default: "grass1", // frames in the sprite sheet
                alt1: "grass2",
                alt2: "grass3",
            },
            prob: {
                default: 0.33,
                alt1: 0.33,
                alt2: 0.33,
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
        decorations: {
            grass: {
                probability: 0.5, // TODO: to be modified by how strong the perlin noice affects the tile eg. how much "forest" this tile is
                minInstances: 1,
                maxInstances: 5,
                radius: 1,
                asset: {
                    path: "biomes/grass",
                    variants: {
                        default: "0053",
                        alt1: "0052",
                        alt2: "0054",
                    },
                    prob: {
                        default: 0.33,
                        alt1: 0.33,
                        alt2: 0.33,
                    },
                    width: 0.5,
                    height: 0.5,
                    precision: worldSeed.spatial.unit.precision,
                },
            },
        },
    },
    desert: {
        biome: "desert",
        name: "Desert",
        description:
            "A dry, arid region with extreme temperatures, sparse vegetation, and limited wildlife.",
        traversableSpeed: 1.0,
    },
    tundra: {
        biome: "tundra",
        name: "Tundra",
        description:
            "A cold, treeless area with a frozen subsoil, limited vegetation, and adapted wildlife.",
        traversableSpeed: 1.0,
    },
    grassland: {
        biome: "grassland",
        name: "Grassland",
        description:
            "A region dominated by grasses, with few trees and a diverse range of wildlife.",
        traversableSpeed: 1.0,
    },
    wetland: {
        biome: "wetland",
        name: "Wetland",
        description:
            "An area saturated with water, supporting aquatic plants and a rich biodiversity.",
        traversableSpeed: 0.5,
    },
    mountain: {
        biome: "mountain",
        name: "Mountain",
        description:
            "A high elevation region with steep terrain, diverse ecosystems, and unique wildlife.",
        traversableSpeed: 0,
    },
    hills: {
        biome: "hills",
        name: "Hills",
        description:
            "A region of elevated terrain, with a variety of wildlife.",
        traversableSpeed: 0.5,
    },
    plains: {
        biome: "plains",
        name: "Plains",
        description: "A large area of flat land, with a variety of wildlife.",
        traversableSpeed: 1.0,
    },
    swamp: {
        biome: "swamp",
        name: "Swamp",
        description:
            "A wetland area with a variety of vegetation, supporting a diverse range of wildlife.",
        traversableSpeed: 0.7,
    },
    water: {
        biome: "water",
        name: "Water",
        description: "A large body of water, with a variety of aquatic life.",
        traversableSpeed: 0,
        asset: {
            path: "biomes/terrain",
            variants: {
                default: "rocks1",
                alt1: "rocks2",
                alt2: "rocks3",
            },
            prob: {
                default: 0.33,
                alt1: 0.33,
                alt2: 0.33,
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
    ice: {
        biome: "ice",
        name: "Ice",
        description:
            "A region covered in ice, with limited vegetation and wildlife.",
        traversableSpeed: 0.8,
        asset: {
            path: "biomes/terrain",
            variants: {
                default: "desert1", // frames in the sprite sheet
                alt1: "desert2",
                alt2: "desert3",
            },
            prob: {
                default: 0.33,
                alt1: 0.33,
                alt2: 0.33,
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
        decorations: {
            grass: {
                probability: 0.5, // TODO: to be modified by how strong the perlin noice affects the tile eg. how much "forest" this tile is
                minInstances: 1,
                maxInstances: 5,
                radius: 1,
                asset: {
                    path: "biomes/grass",
                    variants: {
                        default: "0053",
                        alt1: "0052",
                        alt2: "0054",
                    },
                    prob: {
                        default: 0.33,
                        alt1: 0.33,
                        alt2: 0.33,
                    },
                    width: 0.5,
                    height: 0.5,
                    precision: worldSeed.spatial.unit.precision,
                },
            },
        },
    },
};

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

function topologyTile(geohash: string): {
    url: string;
    topLeft: string;
    rows: number;
    cols: number;
    row: number;
    col: number;
    tlCol: number;
    tlRow: number;
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
        tlCol,
        tlRow,
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

type Pixel = { x: number; y: number; intensity: number };

function bilinearInterpolation({
    bl,
    tl,
    br,
    tr,
    x,
    y,
}: {
    bl: Pixel;
    tl: Pixel;
    br: Pixel;
    tr: Pixel;
    x: number;
    y: number;
}): number {
    const { x: x1, y: y1, intensity: I11 } = bl; // Bottom-left corner
    const { x: x1_b, y: y2, intensity: I12 } = tl; // Top-left corner
    const { x: x2, y: y1_b, intensity: I21 } = br; // Bottom-right corner
    const { x: x2_b, y: y2_b, intensity: I22 } = tr; // Top-right corner

    // Interpolate in the x-direction
    const I_x1 = (I11 * (x2 - x)) / (x2 - x1) + (I21 * (x - x1)) / (x2 - x1);
    const I_x2 = (I12 * (x2 - x)) / (x2 - x1) + (I22 * (x - x1)) / (x2 - x1);

    // Interpolate in the y-direction
    const I = (I_x1 * (y2 - y)) / (y2 - y1) + (I_x2 * (y - y1)) / (y2 - y1);

    return I;
}

// TODO: cache the results of this function
async function topologyAtGeohash(
    geohash: string,
    options?: {
        responseCache?: CacheInterface;
        bufferCache?: CacheInterface;
    },
): Promise<{
    intensity: number;
    width: number; // of the image
    height: number;
    x: number; // pixel coordinate in the image
    y: number;
    png: PNGWithMetadata;
    url: string;
    tile: {
        origin: {
            // world coordinate of the top left corner of the tile
            col: number;
            row: number;
        };
        rows: number;
        cols: number;
    };
}> {
    const { rows, cols, url, row, col, tlCol, tlRow } = topologyTile(geohash);
    const png = await topologyBuffer(url, {
        responseCache: options?.responseCache,
        bufferCache: options?.bufferCache,
    });

    const { width, height, data } = png;
    const xRaw = (width - 1) * (col / cols); // x, y is 0 indexed
    const yRaw = (height - 1) * (row / rows);
    const x = Math.floor(xRaw); // must use floor not round!!!
    const y = Math.floor(yRaw);
    const xPixel = xRaw - Math.floor(xRaw);
    const yPixel = yRaw - Math.floor(yRaw);

    // Smooth out the intensity by averaging the surrounding pixels
    const index = y * width + x;
    const ym = Math.max(y - 1, 0);
    const yp = Math.min(y + 1, height - 1);
    const xm = Math.max(x - 1, 0);
    const xp = Math.min(x + 1, width - 1);
    const nwIdx = ym * width + xm;
    const nIdx = ym * width + x;
    const neIdx = ym * width + xp;
    const wIdx = y * width + xm;
    const eIdx = y * width + xp;
    const swIdx = yp * width + xm;
    const sIdx = yp * width + x;
    const seIdx = yp * width + xp;

    let intensity = 0;

    if (xPixel < 0.5) {
        if (yPixel < 0.5) {
            // nw, n, w, current
            intensity = bilinearInterpolation({
                tl: { x: -0.5, y: -0.5, intensity: data[nwIdx * 4] }, // nw
                tr: { x: 0.5, y: -0.5, intensity: data[nIdx * 4] }, // n
                bl: { x: -0.5, y: 0.5, intensity: data[wIdx * 4] }, // w
                br: { x: 0.5, y: 0.5, intensity: data[index * 4] }, // current
                x: xPixel,
                y: yPixel,
            });
        } else {
            // w, current, sw, s
            intensity = bilinearInterpolation({
                tl: { x: -0.5, y: 0.5, intensity: data[wIdx * 4] }, // w
                tr: { x: 0.5, y: 0.5, intensity: data[index * 4] }, // current
                bl: { x: -0.5, y: 1.5, intensity: data[swIdx * 4] }, // sw
                br: { x: 0.5, y: 1.5, intensity: data[sIdx * 4] }, // s
                x: xPixel,
                y: yPixel,
            });
        }
    } else {
        if (yPixel < 0.5) {
            // n, ne, current, e
            intensity = bilinearInterpolation({
                tl: { x: 0.5, y: -0.5, intensity: data[nIdx * 4] }, // n
                tr: { x: 1.5, y: -0.5, intensity: data[neIdx * 4] }, // ne
                bl: { x: 0.5, y: 0.5, intensity: data[index * 4] }, // current
                br: { x: 1.5, y: 0.5, intensity: data[eIdx * 4] }, // e
                x: xPixel,
                y: yPixel,
            });
        } else {
            // current, e, s, se
            intensity = bilinearInterpolation({
                tl: { x: 0.5, y: 0.5, intensity: data[index * 4] }, // current
                tr: { x: 1.5, y: 0.5, intensity: data[eIdx * 4] }, // e
                bl: { x: 0.5, y: 1.5, intensity: data[sIdx * 4] }, // s
                br: { x: 1.5, y: 1.5, intensity: data[seIdx * 4] }, // se
                x: xPixel,
                y: yPixel,
            });
        }
    }

    return {
        width,
        height,
        x,
        y,
        intensity,
        png,
        url,
        tile: {
            origin: {
                col: tlCol,
                row: tlRow,
            },
            rows,
            cols,
        },
    };
}

/**
 * Determines the height in meters at the given geohash based on the topology.
 *
 * @param geohash - The geohash coordinate string.
 * @returns The height at the given geohash.
 */
async function elevationAtGeohash(
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
    const height = await elevationAtGeohash(geohash, {
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
    return {
        geohash,
        name: geohash, // TODO: get name from POI
        description: biomes[biome].description,
    };
}
