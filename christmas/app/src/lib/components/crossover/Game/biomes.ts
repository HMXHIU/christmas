import { LRUMemoryCache, memoize } from "$lib/caches";
import {
    biomeAtGeohashCache,
    biomeParametersAtCityCache,
    dungeonGraphCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "$lib/components/crossover/Game/caches";
import {
    autoCorrectGeohashPrecision,
    cartToIso,
    generateEvenlySpacedPoints,
    geohashesNearby,
    geohashToColRow,
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
import { worldSeed } from "$lib/crossover/world/settings/world";
import type { GeohashLocationType } from "$lib/crossover/world/types";
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
const decorationsCache = new LRUMemoryCache({ max: 1000 });

let biomeTexturePositions: Record<string, ShaderTexture> = {};
let decorationsTexturePositions: Record<string, ShaderTexture> = {};

let biomeTextureBuffers = new LRUMemoryCache<Record<string, ShaderTexture>>({
    max: 32,
});
let decorationsTextureBuffers = new LRUMemoryCache<
    Record<string, ShaderTexture>
>({ max: 32 });

const calculateBiomeForRowCol = memoize(
    _calculateBiomeForRowCol,
    biomeCache,
    (row, col, locationType, precision?) => `${row}-${col}`,
);
async function _calculateBiomeForRowCol(
    row: number,
    col: number,
    locationType: GeohashLocationType,
    precision?: number,
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
        precision: precision ?? worldSeed.spatial.unit.precision,
        row,
        col,
    });

    // Get biome properties and asset
    const [biome, strength] = await biomeAtGeohash(geohash, locationType, {
        topologyResponseCache,
        topologyResultCache,
        topologyBufferCache,
        biomeAtGeohashCache,
        biomeParametersAtCityCache,
        dungeonGraphCache,
    });
    const elevation =
        ELEVATION_TO_CELL_HEIGHT *
        (await elevationAtGeohash(geohash, locationType, {
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
    decorationsCache,
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
            if ((noise2D(col / 10, row / 10) + 1) / 2 > probability) {
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

async function calculateTextureBuffers(
    house: string,
    locationType: GeohashLocationType,
): Promise<
    [
        Record<string, ShaderTexture> | undefined,
        Record<string, ShaderTexture> | undefined,
    ]
> {
    // Skip if already in cache
    const biomeShaderTextures = await biomeTextureBuffers.get(house);
    const decorationShaderTextures = await decorationsTextureBuffers.get(house);
    if (biomeShaderTextures && decorationShaderTextures) {
        return [biomeShaderTextures, decorationShaderTextures];
    }

    // Reset instances
    if (biomeShaderTextures) {
        for (const v of Object.values(biomeShaderTextures)) {
            v.instances = 0;
        }
    }
    if (decorationShaderTextures) {
        for (const v of Object.values(decorationShaderTextures)) {
            v.instances = 0;
        }
    }

    // Get the unit precision origin (top left)
    const topLeft = autoCorrectGeohashPrecision(
        house,
        worldSeed.spatial.unit.precision,
    );

    const [colStart, rowStart] = geohashToColRow(topLeft);
    const colEnd = topLeft.length % 2 === 0 ? colStart + 4 : colStart + 8;
    const rowEnd = topLeft.length % 2 === 0 ? rowStart + 8 : rowStart + 4;

    // Create biome shader instances for house
    for (let row = rowStart; row <= rowEnd; row++) {
        for (let col = colStart; col <= colEnd; col++) {
            // Biome texture instances
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
            } = await calculateBiomeForRowCol(row, col, locationType);

            // Use the entire sprite sheet as the texture (Note: must all be in the same sheet)
            const textureUid = texture.source.label;
            const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;

            // Init texture buffers for texture
            if (!(await biomeTextureBuffers.get(house))) {
                await biomeTextureBuffers.set(
                    house,
                    initShaderTextureRecord({}, textureUid, {
                        width,
                        height,
                        texture,
                    }),
                );
            }
            const tbuf = (await biomeTextureBuffers.get(house))![textureUid];

            // Set instance positions
            const stp = tbuf.instances * 3;
            tbuf.positions![stp] = isoX;
            tbuf.positions![stp + 1] = isoY;
            tbuf.positions![stp + 2] = elevation;

            // Set instance uvs
            const stuv = tbuf.instances * 4;
            tbuf.uvsX![stuv] = x0;
            tbuf.uvsX![stuv + 1] = x1;
            tbuf.uvsX![stuv + 2] = x2;
            tbuf.uvsX![stuv + 3] = x3;
            tbuf.uvsY![stuv] = y0;
            tbuf.uvsY![stuv + 1] = y1;
            tbuf.uvsY![stuv + 2] = y2;
            tbuf.uvsY![stuv + 3] = y3;

            // Set instance sizes
            const sts = tbuf.instances * 2;
            tbuf.sizes![sts] = width;
            tbuf.sizes![sts + 1] = height;

            // Set instance anchors
            tbuf.anchors![sts] = texture.defaultAnchor?.x || 0.5;
            tbuf.anchors![sts + 1] = texture.defaultAnchor?.y || 0.5;

            // Increment instances
            tbuf.instances += 1;

            // Decoration texture instances
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

                // Init texture buffers for decorations
                if (!(await decorationsTextureBuffers.get(house))) {
                    await decorationsTextureBuffers.set(
                        house,
                        initShaderTextureRecord({}, textureUid, {
                            width,
                            height,
                            texture,
                        }),
                    );
                }
                const tbuf = (await decorationsTextureBuffers.get(house))![
                    textureUid
                ];

                // Set instance positions
                tbuf.positions!.set(
                    positions!.subarray(0, instances * 3),
                    tbuf.instances * 3, // offset
                );

                // Set instance uvs
                const stuv = tbuf.instances * 4;
                tbuf.uvsX![stuv] = x0;
                tbuf.uvsX![stuv + 1] = x1;
                tbuf.uvsX![stuv + 2] = x2;
                tbuf.uvsX![stuv + 3] = x3;
                tbuf.uvsY![stuv] = y0;
                tbuf.uvsY![stuv + 1] = y1;
                tbuf.uvsY![stuv + 2] = y2;
                tbuf.uvsY![stuv + 3] = y3;

                // Set instance sizes
                const sts = tbuf.instances * 2;
                tbuf.sizes![sts] = width;
                tbuf.sizes![sts + 1] = height;

                // Set instance anchors
                tbuf.anchors![sts] = texture.defaultAnchor?.x || 0.5;
                tbuf.anchors![sts + 1] = texture.defaultAnchor?.y || 0.5;

                // Increment instances
                tbuf.instances += 1;
            }
        }
    }

    return [
        await biomeTextureBuffers.get(house),
        await decorationsTextureBuffers.get(house),
    ];
}

function initShaderTextureRecord(
    record: Record<string, ShaderTexture>,
    textureUid: string,
    {
        width,
        height,
        texture,
    }: { width: number; height: number; texture: Texture },
): Record<string, ShaderTexture> {
    if (record[textureUid] == null) {
        record[textureUid] = {
            texture,
            positions: new Float32Array(MAX_SHADER_GEOMETRIES * 3).fill(-1), // x, y, elevation
            uvsX: new Float32Array(MAX_SHADER_GEOMETRIES * 4), // x0, x1, x2, x3
            uvsY: new Float32Array(MAX_SHADER_GEOMETRIES * 4), // y0, y1, y2, y3
            sizes: new Float32Array(MAX_SHADER_GEOMETRIES * 2), // w, h
            anchors: new Float32Array(MAX_SHADER_GEOMETRIES * 2), // x, y
            width,
            height,
            instances: 0,
        };
    }
    return record;
}

function insertTextureBuffer(
    from: Record<string, ShaderTexture>,
    to: Record<string, ShaderTexture>,
): Record<string, ShaderTexture> {
    // Copy biome buffers
    for (const [
        textureUid,
        {
            texture,
            width,
            height,
            positions,
            uvsX,
            uvsY,
            anchors,
            sizes,
            instances,
        },
    ] of Object.entries(from)) {
        // Copy buffers
        let tbuf = initShaderTextureRecord(to, textureUid, {
            width,
            height,
            texture,
        })[textureUid];

        tbuf.positions.set(
            positions.subarray(0, instances * 3),
            tbuf.instances * 3, // offset
        );
        tbuf.sizes!.set(sizes!.subarray(0, instances * 2), tbuf.instances * 2);
        tbuf.anchors!.set(
            anchors!.subarray(0, instances * 2),
            tbuf.instances * 2,
        );
        tbuf.uvsX!.set(uvsX!.subarray(0, instances * 4), tbuf.instances * 4);
        tbuf.uvsY!.set(uvsY!.subarray(0, instances * 4), tbuf.instances * 4);
        tbuf.uvsY!.set(uvsY!.subarray(0, instances * 4), tbuf.instances * 4);

        // Increment instances
        tbuf.instances += instances;
    }

    return to;
}

async function drawBiomeShaders(playerPosition: Position, stage: Container) {
    // Reset instances
    for (const r of Object.values(biomeTexturePositions)) {
        r.instances = 0;
    }
    for (const r of Object.values(decorationsTexturePositions)) {
        r.instances = 0;
    }

    // Get the houses around the player
    const houses = geohashesNearby(
        playerPosition.geohash.slice(0, worldSeed.spatial.house.precision),
        true,
    );

    // Copy buffers
    for (const h of houses) {
        const [biomeBuffers, decorationBuffers] = await calculateTextureBuffers(
            h,
            playerPosition.locationType,
        );
        if (biomeBuffers) {
            insertTextureBuffer(biomeBuffers, biomeTexturePositions);
        }
        if (decorationBuffers) {
            insertTextureBuffer(decorationBuffers, decorationsTexturePositions);
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
        shaderTextures: decorationsTexturePositions,
        numGeometries: MAX_SHADER_GEOMETRIES,
        stage,
        ...layers.depthPartition("entity"), // grass is at the entity layer
    });
}
