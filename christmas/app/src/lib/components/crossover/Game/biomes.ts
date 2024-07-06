import { LRUMemoryCache, memoize } from "$lib/caches";
import {
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "$lib/crossover/caches";
import {
    cartToIso,
    generateEvenlySpacedPoints,
    seededRandom,
    stringToRandomNumber,
} from "$lib/crossover/utils";
import {
    biomeAtGeohash,
    biomes,
    elevationAtGeohash,
} from "$lib/crossover/world/biomes";
import { gridCellToGeohash } from "$lib/crossover/world/utils";
import type { Texture } from "pixi.js";
import { MAX_SHADER_GEOMETRIES, type ShaderTexture } from "../shaders";
import {
    CELL_HEIGHT,
    CELL_WIDTH,
    ELEVATION_TO_CELL_HEIGHT,
    HALF_ISO_CELL_HEIGHT,
    HALF_ISO_CELL_WIDTH,
    loadAssetTexture,
    type Position,
} from "./utils";

export { calculateBiomeDecorationsForRowCol, calculateBiomeForRowCol };

// Caches
const biomeCache = new LRUMemoryCache({ max: 1000 });
const biomeDecorationsCache = new LRUMemoryCache({ max: 1000 });

const calculateBiomeForRowCol = memoize(
    _calculateBiomeForRowCol,
    biomeCache,
    (playerPosition, row, col) => `${row}-${col}`,
);
async function _calculateBiomeForRowCol(
    playerPosition: Position,
    row: number,
    col: number,
): Promise<{
    texture: Texture;
    isoX: number;
    isoY: number;
    elevation: number;
    biome: string;
    geohash: string;
    strength: number;
    width: number;
    height: number;
}> {
    const geohash = gridCellToGeohash({
        precision: playerPosition.precision,
        row,
        col,
    });

    // Get biome properties and asset
    const [biome, strength] = await biomeAtGeohash(geohash, {
        topologyResponseCache,
        topologyResultCache,
        topologyBufferCache,
    });
    const elevation =
        ELEVATION_TO_CELL_HEIGHT *
        (await elevationAtGeohash(geohash, {
            responseCache: topologyResponseCache,
            resultsCache: topologyResultCache,
            bufferCache: topologyBufferCache,
        }));

    const asset = biomes[biome].asset;
    if (!asset) {
        throw new Error(`Missing asset for ${biome}`);
    }

    // Load texture (probability of variant is defined in the asset metadata)
    const texture = await loadAssetTexture(asset, {
        seed: (row << 8) + col, // bit shift by 8 else gridRow + gridCol is the same at diagonals
    });
    if (!texture) {
        throw new Error(`Missing texture for ${biome}`);
    }

    // Scale the width and height of the texture to the cell while maintaining aspect ratio
    const width = CELL_WIDTH;
    const height = (texture.height * width) / texture.width;

    // Convert cartesian to isometric position
    // Note: snap to grid for biomes, so that we can do O(1) lookups for highlights
    const [isoX, isoY] = cartToIso(col * CELL_WIDTH, row * CELL_HEIGHT, {
        x: HALF_ISO_CELL_WIDTH,
        y: HALF_ISO_CELL_HEIGHT,
    });

    return {
        geohash,
        biome,
        strength,
        texture,
        isoX,
        isoY,
        elevation,
        width,
        height,
    };
}

const calculateBiomeDecorationsForRowCol = memoize(
    _calculateBiomeDecorationsForRowCol,
    biomeDecorationsCache,
    ({ row, col }) => `${row}-${col}`,
);
async function _calculateBiomeDecorationsForRowCol({
    geohash,
    biome,
    strength,
    row,
    col,
    isoX,
    isoY,
    elevation,
}: {
    geohash: string;
    biome: string;
    strength: number;
    row: number;
    col: number;
    isoX: number;
    isoY: number;
    elevation: number;
}): Promise<Record<string, ShaderTexture>> {
    const texturePositions: Record<string, ShaderTexture> = {};

    // TODO: Skip decorations in world

    // Get biome decorations
    const decorations = biomes[biome].decorations;
    if (!decorations) {
        return texturePositions;
    }
    const geohashSeed = stringToRandomNumber(geohash);

    for (const [
        name,
        { asset, probability, minInstances, maxInstances, radius },
    ] of Object.entries(decorations)) {
        // Determine if this geohash should have decorations
        const dice = seededRandom(geohashSeed);
        if (dice > probability) {
            continue;
        }

        // Number of instances depends on the strength of the tile
        let numInstances = Math.ceil(
            minInstances + strength * (maxInstances - minInstances),
        );

        // Get evenly spaced offsets
        const spacedOffsets = generateEvenlySpacedPoints(
            numInstances,
            CELL_WIDTH * radius,
        );

        for (let i = 0; i < numInstances; i++) {
            const instanceSeed = seededRandom((row << 8) + col + i);
            const instanceRv = seededRandom(instanceSeed);

            // Load texture
            const texture = await loadAssetTexture(asset, {
                seed: instanceSeed,
            });
            if (!texture) {
                console.error(`Missing texture for ${name}`);
                continue;
            }

            // Initialize decorations
            if (texturePositions[texture.uid] == null) {
                texturePositions[texture.uid] = {
                    texture,
                    positions: new Float32Array(MAX_SHADER_GEOMETRIES * 3).fill(
                        -1,
                    ), // x, y, h
                    height: texture.height,
                    width: texture.width,
                    instances: 0,
                };
            }

            // Evenly space out decorations and add jitter
            const jitter = ((instanceRv - 0.5) * CELL_WIDTH) / 2;
            const x = spacedOffsets[i].x + isoX + jitter;
            const y = spacedOffsets[i].y + isoY + jitter;

            // Add to decoration positions
            const ref = texturePositions[texture.uid];
            const st = ref.instances * 3;
            ref.positions![st] = x;
            ref.positions![st + 1] = y;
            ref.positions![st + 2] = elevation;
            ref.instances += 1;
        }
    }
    return texturePositions;
}
