import { LRUMemoryCache, memoize } from "$lib/caches";
import {
    biomeAtGeohashCache,
    biomeParametersAtCityCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "$lib/components/crossover/Game/caches";
import {
    cartToIso,
    generateEvenlySpacedPoints,
    gridCellToGeohash,
    seededRandom,
    stringToRandomNumber,
} from "$lib/crossover/utils";
import {
    biomeAtGeohash,
    biomes,
    elevationAtGeohash,
    type BiomeType,
} from "$lib/crossover/world/biomes";
import type { Container, Texture } from "pixi.js";
import {
    drawShaderTextures,
    MAX_SHADER_GEOMETRIES,
    type ShaderTexture,
} from "../shaders";
import { layers } from "./layers";
import {
    CELL_HEIGHT,
    CELL_WIDTH,
    ELEVATION_TO_CELL_HEIGHT,
    GRID_MID_COL,
    GRID_MID_ROW,
    HALF_ISO_CELL_HEIGHT,
    HALF_ISO_CELL_WIDTH,
    loadAssetTexture,
    type Position,
} from "./utils";
import { noise2D } from "./world";

export {
    calculateBiomeDecorationsForRowCol,
    calculateBiomeForRowCol,
    drawBiomeShaders,
};

// Caches
const biomeCache = new LRUMemoryCache({ max: 1000 });
const biomeDecorationsCache = new LRUMemoryCache({ max: 1000 });

let biomeTexturePositions: Record<string, ShaderTexture> = {};
let biomeDecorationsTexturePositions: Record<string, ShaderTexture> = {};

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
    biome: BiomeType;
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
    const [biome, strength] = await biomeAtGeohash(
        geohash,
        playerPosition.locationType,
        {
            topologyResponseCache,
            topologyResultCache,
            topologyBufferCache,
            biomeAtGeohashCache,
            biomeParametersAtCityCache,
        },
    );
    const elevation =
        ELEVATION_TO_CELL_HEIGHT *
        (await elevationAtGeohash(geohash, playerPosition.locationType, {
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
    biome: BiomeType;
    strength: number;
    row: number;
    col: number;
    isoX: number;
    isoY: number;
    elevation: number;
}): Promise<Record<string, ShaderTexture>> {
    const texturePositions: Record<string, ShaderTexture> = {};

    // Get biome decorations
    const decorations = biomes[biome].decorations;
    if (!decorations) {
        return texturePositions;
    }
    const geohashSeed = stringToRandomNumber(geohash);

    for (const [
        name,
        { asset, noise, probability, minInstances, maxInstances, radius },
    ] of Object.entries(decorations)) {
        // Determine if this geohash should have decorations
        const dice = seededRandom(geohashSeed);
        if (noise === "simplex") {
            if ((noise2D(col / 100, row / 100) + 1) / 2 > probability) {
                continue;
            }
        } else if (dice > probability) {
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

async function drawBiomeShaders(playerPosition: Position, stage: Container) {
    // Reset instances
    for (const r of Object.values(biomeTexturePositions)) {
        r.instances = 0;
    }
    for (const r of Object.values(biomeDecorationsTexturePositions)) {
        r.instances = 0;
    }

    // Create biome shader instances
    for (
        let row = playerPosition.row - GRID_MID_ROW;
        row <= playerPosition.row + GRID_MID_ROW;
        row++
    ) {
        for (
            let col = playerPosition.col - GRID_MID_COL;
            col <= playerPosition.col + GRID_MID_COL;
            col++
        ) {
            // Fill biomeTexturePositions
            const {
                isoX,
                isoY,
                texture,
                elevation,
                biome,
                geohash,
                strength,
                width,
                height,
            } = await calculateBiomeForRowCol(playerPosition, row, col);

            // Use the entire sprite sheet as the texture (Note: must all be in the same sheet)
            const textureUid = texture.source.label;
            const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;

            if (biomeTexturePositions[textureUid] == null) {
                biomeTexturePositions[textureUid] = {
                    texture,
                    positions: new Float32Array(MAX_SHADER_GEOMETRIES * 3).fill(
                        -1,
                    ), // x, y, elevation
                    uvsX: new Float32Array(MAX_SHADER_GEOMETRIES * 4), // x0, x1, x2, x3
                    uvsY: new Float32Array(MAX_SHADER_GEOMETRIES * 4), // y0, y1, y2, y3
                    sizes: new Float32Array(MAX_SHADER_GEOMETRIES * 2), // w, h
                    anchors: new Float32Array(MAX_SHADER_GEOMETRIES * 2), // x, y
                    width,
                    height,
                    instances: 0,
                };
            } else {
                let ref = biomeTexturePositions[textureUid];

                // Set instance positions
                const stp = ref.instances * 3;
                ref.positions![stp] = isoX;
                ref.positions![stp + 1] = isoY;
                ref.positions![stp + 2] = elevation;

                // Set instance uvs
                const stuv = ref.instances * 4;
                ref.uvsX![stuv] = x0;
                ref.uvsX![stuv + 1] = x1;
                ref.uvsX![stuv + 2] = x2;
                ref.uvsX![stuv + 3] = x3;
                ref.uvsY![stuv] = y0;
                ref.uvsY![stuv + 1] = y1;
                ref.uvsY![stuv + 2] = y2;
                ref.uvsY![stuv + 3] = y3;

                // Set instance sizes
                const sts = ref.instances * 2;
                ref.sizes![sts] = width;
                ref.sizes![sts + 1] = height;

                // Set instance anchors
                ref.anchors![sts] = texture.defaultAnchor?.x || 0.5;
                ref.anchors![sts + 1] = texture.defaultAnchor?.y || 0.5;

                // Increment instances
                ref.instances += 1;
            }

            // Fill biomeDecorationsTexturePositions
            for (const {
                positions,
                texture,
                height,
                width,
                instances,
            } of Object.values(
                await calculateBiomeDecorationsForRowCol({
                    geohash,
                    biome,
                    strength,
                    row,
                    col,
                    isoX,
                    isoY,
                    elevation,
                }),
            )) {
                // Use the entire sprite sheet as the texture (Note: must all be in the same sheet)
                const textureUid = texture.source.label;
                const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;

                if (biomeDecorationsTexturePositions[textureUid] == null) {
                    biomeDecorationsTexturePositions[textureUid] = {
                        texture,
                        positions: new Float32Array(
                            MAX_SHADER_GEOMETRIES * 3,
                        ).fill(-1), // x, y, elevation
                        uvsX: new Float32Array(MAX_SHADER_GEOMETRIES * 4), // x0, x1, x2, x3
                        uvsY: new Float32Array(MAX_SHADER_GEOMETRIES * 4), // y0, y1, y2, y3
                        sizes: new Float32Array(MAX_SHADER_GEOMETRIES * 2), // w, h
                        anchors: new Float32Array(MAX_SHADER_GEOMETRIES * 2), // x, y
                        width,
                        height,
                        instances: 0,
                    };
                } else {
                    const ref = biomeDecorationsTexturePositions[textureUid];

                    // Set instance positions
                    ref.positions!.set(
                        positions!.subarray(0, instances * 3),
                        ref.instances * 3, // offset
                    );

                    // Set instance uvs
                    const stuv = ref.instances * 4;
                    ref.uvsX![stuv] = x0;
                    ref.uvsX![stuv + 1] = x1;
                    ref.uvsX![stuv + 2] = x2;
                    ref.uvsX![stuv + 3] = x3;
                    ref.uvsY![stuv] = y0;
                    ref.uvsY![stuv + 1] = y1;
                    ref.uvsY![stuv + 2] = y2;
                    ref.uvsY![stuv + 3] = y3;

                    // Set instance sizes
                    const sts = ref.instances * 2;
                    ref.sizes![sts] = width;
                    ref.sizes![sts + 1] = height;

                    // Set instance anchors
                    ref.anchors![sts] = texture.defaultAnchor?.x || 0.5;
                    ref.anchors![sts + 1] = texture.defaultAnchor?.y || 0.5;

                    // Increment instances
                    ref.instances += 1;
                }
            }
        }
    }

    // Draw shaders
    await drawShaderTextures({
        shaderName: "biome",
        shaderTextures: biomeTexturePositions,
        numGeometries: MAX_SHADER_GEOMETRIES,
        stage,
        ...layers.depthPartition("biome"),
    });
    await drawShaderTextures({
        shaderName: "grass",
        shaderTextures: biomeDecorationsTexturePositions,
        numGeometries: MAX_SHADER_GEOMETRIES,
        stage,
        ...layers.depthPartition("entity"), // grass is at the entity layer
    });
}
