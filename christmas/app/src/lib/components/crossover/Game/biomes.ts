import { LRUMemoryCache } from "$lib/caches";
import {
    biomeAtGeohashCache,
    biomeParametersAtCityCache,
    dungeonGraphCache,
    dungeonsAtTerritoryCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "$lib/crossover/caches";
import type { Item } from "$lib/crossover/types";
import {
    autoCorrectGeohashPrecision,
    borderingGeohashes,
    generateEvenlySpacedPoints,
    geohashesNearby,
    geohashToColRow,
    gridCellToGeohash,
} from "$lib/crossover/utils";
import {
    biomeAtGeohash,
    biomes,
    elevationAtGeohash,
    type BiomeType,
    type LandGrading,
} from "$lib/crossover/world/biomes";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import {
    geohashLocationTypes,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import { seededRandom, stringToRandomNumber } from "$lib/utils/random";
import type { Container, Texture } from "pixi.js";
import { get } from "svelte/store";
import { landGrading } from "../../../../store";
import {
    drawShaderTextures,
    HIGHLIGHTS,
    MAX_SHADER_GEOMETRIES,
    type ShaderTexture,
} from "../shaders";
import { layers } from "./layers";
import {
    CELL_HEIGHT,
    CELL_WIDTH,
    ELEVATION_TO_ISO,
    HALF_ISO_CELL_HEIGHT,
    HALF_ISO_CELL_WIDTH,
} from "./settings";
import { updateScreenHitTesting } from "./ui";
import { cartToIso, loadAssetTexture, type Position } from "./utils";
import { noise2D } from "./world";

export {
    calculateBiomeDecorationsForRowCol,
    calculateBiomeForRowCol,
    calculateLandGrading,
    drawBiomeShaders,
};

// Caches
const biomeCache = new LRUMemoryCache({ max: 2000 });
const decorationsCache = new LRUMemoryCache({ max: 2000 });

// Buffers
let biomeTexturePositions: Record<string, ShaderTexture> = {};
let decorationsTexturePositions: Record<string, ShaderTexture> = {};
let biomeTextureBuffers = new LRUMemoryCache<Record<string, ShaderTexture>>({
    max: 32,
});
let decorationsTextureBuffers = new LRUMemoryCache<
    Record<string, ShaderTexture>
>({ max: 32 });

async function calculateLandGrading(items: Item[]): Promise<LandGrading> {
    const landGrading: LandGrading = {};

    for (const item of items) {
        const prop = compendium[item.prop];

        // Immovable objects with dimensions greater than 1 cell
        if (
            geohashLocationTypes.has(item.locT) &&
            prop.weight < 0 &&
            item.loc.length > 1
        ) {
            const elevation =
                ELEVATION_TO_ISO *
                (await elevationAtGeohash(
                    item.loc[0],
                    item.locT as GeohashLocation,
                    {
                        responseCache: topologyResponseCache,
                        resultsCache: topologyResultCache,
                        bufferCache: topologyBufferCache,
                    },
                ));

            // Init
            item.locT = item.locT as GeohashLocation;
            if (landGrading[item.locT] == null) {
                landGrading[item.locT] = {};
            }

            // Flatten the elevation
            for (const l of item.loc) {
                landGrading[item.locT]![l] = {
                    elevation,
                    decorations: false,
                };
            }
            // Disable decorations on bordering geohashes
            for (const l of borderingGeohashes(item.loc)) {
                if (landGrading[item.locT]![l]) {
                    landGrading[item.locT]![l].decorations = false;
                } else {
                    landGrading[item.locT]![l] = {
                        elevation,
                        decorations: false,
                    };
                }
            }
        }
    }
    return landGrading;
}

async function calculateBiomeForRowCol(
    row: number,
    col: number,
    locationType: GeohashLocation,
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
    // Get from cache
    const cacheKey = `${row}-${col}-${locationType}`;
    const cached = await biomeCache.get(cacheKey);
    if (cached) return cached;

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
        dungeonsAtTerritoryCache,
    });

    const elevation =
        ELEVATION_TO_ISO *
        (await elevationAtGeohash(geohash, locationType, {
            responseCache: topologyResponseCache,
            resultsCache: topologyResultCache,
            bufferCache: topologyBufferCache,
            landGrading: get(landGrading),
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

    // Convert cartesian to isometric position (provide snap, so that the instance positions are indexable for highlighting)
    const [isoX, isoY] = cartToIso(col * CELL_WIDTH, row * CELL_HEIGHT, {
        x: HALF_ISO_CELL_WIDTH,
        y: HALF_ISO_CELL_HEIGHT,
    });

    const result = {
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

    // Set cache
    await biomeCache.set(cacheKey, result);

    return result;
}

async function calculateBiomeDecorationsForRowCol({
    geohash,
    biome,
    strength,
    row,
    col,
    isoX,
    isoY,
    elevation,
    locationType,
}: {
    geohash: string;
    biome: BiomeType;
    strength: number;
    row: number;
    col: number;
    isoX: number;
    isoY: number;
    elevation: number;
    locationType: GeohashLocation;
}): Promise<Record<string, ShaderTexture>> {
    // Get from cache
    const cacheKey = `${row}-${col}-${locationType}`;
    const cached = await decorationsCache.get(cacheKey);
    if (cached) return cached;

    const texturePositions: Record<string, ShaderTexture> = {};

    // Check land grading ig this cell should have decorations
    if (get(landGrading)[locationType]?.[geohash]?.decorations === false) {
        return texturePositions;
    }

    // Get biome decorations
    const decorations = biomes[biome].decorations;
    if (!decorations) {
        return texturePositions;
    }
    const geohashSeed = stringToRandomNumber(geohash + locationType);

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

    // Set cache
    await decorationsCache.set(cacheKey, texturePositions);

    return texturePositions;
}

async function calculateTextureBuffers(
    house: string,
    locationType: GeohashLocation,
): Promise<
    [
        Record<string, ShaderTexture> | undefined,
        Record<string, ShaderTexture> | undefined,
    ]
> {
    const bufferKey = `${house}-${locationType}`;

    // Skip if already in cache
    const biomeShaderTextures = await biomeTextureBuffers.get(bufferKey);
    const decorationShaderTextures =
        await decorationsTextureBuffers.get(bufferKey);
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

            // Update screenToGeohashKDtree (for hit testing screen coordiates to the geohash)
            updateScreenHitTesting(
                [isoX, isoY - elevation],
                locationType,
                geohash,
            );

            // Don't draw biomes when inside buildings (still need to calculate hit testing)
            if (locationType === "in") {
                continue;
            }

            // Use the entire sprite sheet as the texture (Note: must all be in the same sheet)
            const textureUid = texture.source.label;
            const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;

            // Init texture buffers for texture
            if (!(await biomeTextureBuffers.get(bufferKey))) {
                await biomeTextureBuffers.set(
                    bufferKey,
                    initShaderTextureRecord({}, textureUid, {
                        width,
                        height,
                        texture,
                    }),
                );
            }
            const tbuf = (await biomeTextureBuffers.get(bufferKey))![
                textureUid
            ];

            // Set instance positions
            const stp = tbuf.instances * 3;
            tbuf.positions![stp] = isoX;
            tbuf.positions![stp + 1] = isoY;
            tbuf.positions![stp + 2] = elevation;

            /* 
            Set highlights (shadows) 
                - Sun is on the east
                - Every cell should cast a shadow of 3 cells from east to west
                - Each shadow cast should be from strong (closer to the object) to light
                - If shadows overlap (choose the stronger one)
                - Check if cell to the east is higher, cell should be in shadow
                - To avoid making the shadows flat, use 2 levels, if overlap, use a stronger shadow
            */
            const { elevation: eastElevation } = await calculateBiomeForRowCol(
                row,
                col + 1, // east (shadow)
                locationType,
            );
            const { elevation: east2Elevation } = await calculateBiomeForRowCol(
                row,
                col + 2, // east * 2 (light shadow)
                locationType,
            );
            const { elevation: east3Elevation } = await calculateBiomeForRowCol(
                row,
                col + 3, // east * 3 (mild shadow)
                locationType,
            );
            if (eastElevation > elevation) {
                tbuf.highlights![tbuf.instances] = HIGHLIGHTS.shadowStrong;
            } else if (east2Elevation > elevation) {
                tbuf.highlights![tbuf.instances] = HIGHLIGHTS.shadow;
            } else if (east3Elevation > elevation) {
                tbuf.highlights![tbuf.instances] = HIGHLIGHTS.shadowLight;
            }

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
                    locationType,
                }),
            )) {
                // Use the entire sprite sheet as the texture (Note: must all be in the same sheet)
                const textureUid = texture.source.label;
                const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;

                // Init texture buffers for decorations
                if (!(await decorationsTextureBuffers.get(bufferKey))) {
                    await decorationsTextureBuffers.set(
                        bufferKey,
                        initShaderTextureRecord({}, textureUid, {
                            width,
                            height,
                            texture,
                        }),
                    );
                }
                const tbuf = (await decorationsTextureBuffers.get(bufferKey))![
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
        await biomeTextureBuffers.get(bufferKey),
        await decorationsTextureBuffers.get(bufferKey),
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
            highlights: new Float32Array(MAX_SHADER_GEOMETRIES).fill(-1), // highlight
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
            highlights,
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
        tbuf.highlights!.set(
            highlights!.subarray(0, instances),
            tbuf.instances,
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

    // Draw biome shader
    await drawShaderTextures({
        shaderName: "biome",
        shaderTextures: biomeTexturePositions,
        numGeometries: MAX_SHADER_GEOMETRIES,
        stage,
        ...layers.depthPartition("biome"),
    });

    // Draw decoration shader
    const { depthScale, depthStart, depthLayer, depthSize } =
        layers.depthPartition("entity"); // grass is at the same depth as entities
    await drawShaderTextures({
        shaderName: "grass",
        shaderTextures: decorationsTexturePositions,
        numGeometries: MAX_SHADER_GEOMETRIES,
        stage,
        depthScale,
        depthStart,
        depthLayer: depthLayer - depthSize, // bump the zIndex for grass down 1 layer for alpha blending
    });
}
