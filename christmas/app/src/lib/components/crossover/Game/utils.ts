import { PUBLIC_TILED_MINIO_BUCKET } from "$env/static/public";
import { LRUMemoryCache, memoize } from "$lib/caches";
import {
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "$lib/crossover/caches";
import {
    aStarPathfinding,
    autoCorrectGeohashPrecision,
    cartToIso,
    generateEvenlySpacedPoints,
    getEntityId,
    isoToCart,
    seededRandom,
    stringToRandomNumber,
} from "$lib/crossover/utils";
import {
    biomeAtGeohash,
    biomes,
    elevationAtGeohash,
} from "$lib/crossover/world/biomes";
import { compendium } from "$lib/crossover/world/compendium";
import type { AssetMetadata, Direction } from "$lib/crossover/world/types";
import {
    geohashToGridCell,
    gridCellToGeohash,
} from "$lib/crossover/world/utils";
import { worldSeed } from "$lib/crossover/world/world";
import type {
    Item,
    Monster,
    Player,
    World,
} from "$lib/server/crossover/redis/entities";
import {
    Assets,
    Buffer,
    Container,
    Mesh,
    Sprite,
    type Geometry,
    type Shader,
    type Texture,
} from "pixi.js";
import {
    MAX_SHADER_GEOMETRIES,
    loadShaderGeometry,
    loadedGeometry,
} from "./shaders";

export {
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    CELL_HEIGHT,
    CELL_WIDTH,
    ELEVATION_TO_CELL_HEIGHT,
    GRID_MID_COL,
    GRID_MID_ROW,
    HALF_ISO_CELL_HEIGHT,
    HALF_ISO_CELL_WIDTH,
    ISO_CELL_HEIGHT,
    ISO_CELL_WIDTH,
    RENDER_ORDER,
    WORLD_HEIGHT,
    WORLD_WIDTH,
    Z_LAYER,
    Z_OFF,
    Z_SCALE,
    calculateBiomeDecorationsForRowCol,
    calculateBiomeForRowCol,
    calculatePosition,
    clearInstancedShaderMeshes,
    debugColliders,
    decodeTiledSource,
    drawShaderTextures,
    getDirectionsToPosition,
    getImageForTile,
    getTilesetForTile,
    highlightShaderInstances,
    initAssetManager,
    instancedShaderMeshes,
    isCellInView,
    loadAssetTexture,
    swapEntityVariant,
    swapMeshTexture,
    updateEntityMeshRenderOrder,
    type EntityMesh,
    type Position,
    type ShaderTexture,
};

interface Position {
    row: number;
    col: number;
    isoX: number;
    isoY: number;
    geohash: string;
    precision: number;
    elevation: number;
}

interface ShaderTexture {
    texture: Texture;
    positions: Float32Array;
    width: number;
    height: number;
    length: number;
}

interface EntityMesh {
    id: string;
    mesh: Mesh<Geometry, Shader>;
    hitbox: Container; // meshes are added to the hitbox so they can be moved together
    instancePositions: Buffer;
    instanceHighlights: Buffer;
    position: Position;
    entity?: Player | Monster | Item;
    actionIcon?: Mesh<Geometry, Shader>;
    properties?: {
        variant?: string;
    };
}

let instancedShaderMeshes: Record<string, Mesh<Geometry, Shader>> = {};

// Caches
const biomeCache = new LRUMemoryCache({ max: 1000 });
const biomeDecorationsCache = new LRUMemoryCache({ max: 1000 });

// Note: this are cartesian coordinates (CELL_HEIGHT = CELL_WIDTH;)
const CELL_WIDTH = 64;
const CELL_HEIGHT = CELL_WIDTH;
const ISO_CELL_WIDTH = CELL_WIDTH;
const ISO_CELL_HEIGHT = CELL_HEIGHT / 2;
const HALF_ISO_CELL_WIDTH = ISO_CELL_WIDTH / 2;
const HALF_ISO_CELL_HEIGHT = ISO_CELL_HEIGHT / 2;
const CANVAS_ROWS = 7;
const CANVAS_COLS = 7;
const OVERDRAW_MULTIPLE = 3;
const CANVAS_WIDTH = CELL_WIDTH * CANVAS_COLS;
const CANVAS_HEIGHT = CELL_HEIGHT * CANVAS_ROWS;
const WORLD_WIDTH = CANVAS_WIDTH * OVERDRAW_MULTIPLE;
const WORLD_HEIGHT = CANVAS_HEIGHT * OVERDRAW_MULTIPLE;
const GRID_ROWS = CANVAS_ROWS * OVERDRAW_MULTIPLE;
const GRID_COLS = CANVAS_COLS * OVERDRAW_MULTIPLE;
const GRID_MID_ROW = Math.floor(GRID_ROWS / 2);
const GRID_MID_COL = Math.floor(GRID_COLS / 2);

// Z layer offsets
const Z_LAYER = ISO_CELL_HEIGHT * 2;
const Z_OFF: Record<string, number> = {
    // shader
    biome: 0 * Z_LAYER,
    entity: 1 * Z_LAYER,
    // entities
    item: 1 * Z_LAYER,
    monster: 1 * Z_LAYER,
    player: 1 * Z_LAYER,
    // layers
    ground: 0 * Z_LAYER,
    grass: 0 * Z_LAYER,
    floor: 1 * Z_LAYER,
    wall: 2 * Z_LAYER,
    l2: 3 * Z_LAYER,
    l3: 4 * Z_LAYER,
    // entity: 1 * Z_LAYER,
    // floor: 3 * Z_LAYER,
    // wall: 4 * Z_LAYER,
    // item: 4 * Z_LAYER,
    // monster: 4 * Z_LAYER,
    // player: 4 * Z_LAYER,
    // l2: 8 * Z_LAYER,
    // l3: 12 * Z_LAYER,
};

// This is different from depth testing (but used to control when which objects are drawn for alpha blending)
const RENDER_ORDER: Record<string, number> = {
    ground: 0,
    biome: 0,
    floor: 0,
    wall: 0,
    // draw last because it has alpha
    item: 1,
    grass: 1,
    player: 1,
    monster: 1,
    world: 1,
};

// In WebGL, the gl_Position.z value should be in the range [-1 (closer), 1]
const ELEVATION_TO_CELL_HEIGHT = CELL_HEIGHT / 2 / 8; // 1 meter = 1/8 a cell elevation (on isometric coordinates)

// Depth test scaling and offsets
const { row: bottomRightRow, col: bottomRightCol } =
    geohashToGridCell("pbzupuzv");
const Z_SCALE =
    -1 /
    cartToIso(bottomRightCol * CELL_WIDTH, bottomRightRow * CELL_HEIGHT)[1];

async function calculatePosition(
    geohash: string,
    options?: {
        cellWidth?: number;
        cellHeight?: number;
    },
): Promise<Position> {
    const width = options?.cellWidth ?? CELL_WIDTH;
    const height = options?.cellHeight ?? CELL_HEIGHT;
    const { row, col, precision } = geohashToGridCell(geohash);
    const [isoX, isoY] = cartToIso(col * width, row * height);
    const elevation =
        ELEVATION_TO_CELL_HEIGHT *
        (await elevationAtGeohash(geohash, {
            responseCache: topologyResponseCache,
            resultsCache: topologyResultCache,
            bufferCache: topologyBufferCache,
        }));
    return { row, col, isoX, isoY, geohash, precision, elevation };
}

function isCellInView(
    cell: { row: number; col: number }, // no need precision
    playerPosition: Position,
): boolean {
    return (
        cell.row <= playerPosition.row + GRID_MID_ROW &&
        cell.row >= playerPosition.row - GRID_MID_ROW &&
        cell.col <= playerPosition.col + GRID_MID_COL &&
        cell.col >= playerPosition.col - GRID_MID_COL
    );
}

function calculateRowColFromIso(isoX: number, isoY: number): [number, number] {
    const [cartX, cartY] = isoToCart(isoX, isoY);
    const col = Math.round(cartX / CELL_WIDTH);
    const row = Math.round(cartY / CELL_HEIGHT);
    return [row, col];
}

function getDirectionsToPosition(
    playerPosition: Position,
    target: { x: number; y: number },
): Direction[] {
    const [rowEnd, colEnd] = calculateRowColFromIso(target.x, target.y);
    return aStarPathfinding({
        colStart: playerPosition.col,
        rowStart: playerPosition.row,
        colEnd,
        rowEnd,
        getTraversalCost: (row, col) => {
            return 0; // TODO: add actual traversal cost
        },
    });
}

function swapMeshTexture(mesh: Mesh<Geometry, Shader>, texture: Texture) {
    mesh.shader.resources.uTexture = texture.source;
    const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;
    const uvBuffer = mesh.geometry.getBuffer("aUV");
    uvBuffer.data.set([x0, y0, x1, y1, x2, y2, x3, y3]);
    uvBuffer.update();
}

async function swapEntityVariant(entityMesh: EntityMesh, variant: string) {
    if (entityMesh.entity == null) {
        return;
    }

    let texture: Texture | null = null;

    if (entityMesh.properties!.variant !== variant) {
        if ((entityMesh.entity as Item).prop) {
            const item = entityMesh.entity as Item;
            const prop = compendium[item.prop];
            const variant = prop.states[item.state].variant;
            texture = await loadAssetTexture(prop.asset, {
                variant,
            });
        }
    }

    if (!texture) {
        console.error(
            `Missing texture for ${entityMesh.entity.name}:${variant}`,
        );
        return;
    }

    entityMesh.properties!.variant = variant;
    swapMeshTexture(entityMesh.mesh, texture);
}

async function loadAssetTexture(
    asset: AssetMetadata,
    { variant, seed }: { variant?: string; seed?: number } = {},
): Promise<Texture | null> {
    seed ??= 0;

    // Determine variant
    if (variant == null) {
        if (asset.prob != null) {
            const rv = seededRandom(seed);
            const entries = Object.entries(asset.prob);
            let acc = entries[0][1];
            variant = entries[0][0];
            for (const [v, p] of Object.entries(asset.prob)) {
                if (rv < acc) {
                    variant = v;
                    break;
                } else {
                    acc += p;
                }
            }
        }
    }
    variant ??= "default";
    const [bundleName, alias] = asset.path.split("/").slice(-2);
    const bundle = await Assets.loadBundle(bundleName);

    // Bundle might be a sprite sheet or image
    const frame =
        bundle[alias]?.textures?.[asset.variants?.[variant] || "default"] ||
        bundle[alias];
    return frame || null;
}

function decodeTiledSource(path: string): string {
    const source = decodeURIComponent(path) // strip '../'
        .split("/")
        .slice(1)
        .join("/");
    return `/api/storage/${PUBLIC_TILED_MINIO_BUCKET}/public/${source}`;
}

async function getTilesetForTile(
    tileId: number,
    sortedTilesets: { firstgid: number; source: string }[],
): Promise<{ firstgid: number; tileset: any }> {
    for (const ts of sortedTilesets) {
        if (tileId >= ts.firstgid) {
            return {
                tileset: await Assets.load(decodeTiledSource(ts.source)), // this is cached
                firstgid: ts.firstgid,
            };
        }
    }
    throw new Error(`Missing tileset for tileId ${tileId}`);
}

async function getImageForTile(
    tiles: {
        id: number;
        image: string;
        imagewidth: number;
        imageheight: number;
    }[],
    tileId: number,
): Promise<{ texture: Texture; imagewidth: number; imageheight: number }> {
    for (const tile of tiles) {
        if (tile.id === tileId) {
            return {
                texture: await Assets.load(decodeTiledSource(tile.image)),
                imagewidth: tile.imagewidth,
                imageheight: tile.imageheight,
            }; // this is cached
        }
    }
    throw new Error(`Missing image for tileId ${tileId}`);
}

function highlightShaderInstances(
    shaderName: string,
    highlightPositions: Record<string, number>, // {'x,y': highlight}
) {
    for (const [
        _,
        { shader, instanceHighlights, instancePositions },
    ] of Object.entries(loadedGeometry)) {
        if (shader === shaderName) {
            // Iterate `instancePositions` and compare with `highlightPositions`
            for (let i = 0; i < instanceHighlights.data.length; i += 1) {
                const p = i * 3;
                const x = instancePositions.data[p];
                const y = instancePositions.data[p + 1];
                instanceHighlights.data[i] =
                    highlightPositions[`${x},${y}`] ?? 0;
            }
            instanceHighlights.update();
        }
    }
}

function updateEntityMeshRenderOrder(entityMesh: EntityMesh) {
    if (entityMesh.entity == null) {
        return;
    }
    const [_, entityType] = getEntityId(entityMesh.entity);
    const zIndex = RENDER_ORDER[entityType] * entityMesh.position.isoY; // TODO: this does not work during tweening
    entityMesh.mesh.zIndex = zIndex;
    if (entityMesh.actionIcon != null) {
        entityMesh.actionIcon.zIndex = zIndex;
    }
    entityMesh.hitbox.zIndex = zIndex;
}

async function debugColliders(
    stage: Container,
    worldRecord: Record<string, Record<string, World>>,
) {
    const colliderTexture = (await Assets.loadBundle("actions"))["actions"]
        .textures["hiking"];

    // Draw world colliders
    for (const worlds of Object.values(worldRecord)) {
        for (const w of Object.values(worlds)) {
            const origin = autoCorrectGeohashPrecision(
                (w as World).loc[0],
                worldSeed.spatial.unit.precision,
            );
            const position = await calculatePosition(origin);

            for (const cld of w.cld) {
                const { row, col } = geohashToGridCell(cld);

                // Create sprite
                const sprite = new Sprite(colliderTexture);
                sprite.width = CELL_WIDTH;
                sprite.height =
                    (colliderTexture.height * sprite.width) /
                    colliderTexture.width;
                sprite.anchor.set(0.5, 1);

                // Convert cartesian to isometric position
                const [isoX, isoY] = cartToIso(
                    col * CELL_WIDTH,
                    row * CELL_HEIGHT,
                );
                sprite.x = isoX;
                sprite.y = isoY - position.elevation;
                stage.addChild(sprite);
            }
        }
    }
}

async function initAssetManager() {
    // Load assets in background
    await Assets.init({ manifest: "/sprites/manifest.json" });
    Assets.backgroundLoadBundle([
        "player",
        "biomes",
        "bestiary",
        "props",
        "pedestals",
        "actions",
    ]);
}

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

    // Load texture
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
                    length: 0,
                };
            }

            // Evenly space out decorations and add jitter
            const jitter = ((instanceRv - 0.5) * CELL_WIDTH) / 2;
            const x = spacedOffsets[i].x + isoX + jitter;
            const y = spacedOffsets[i].y + isoY + jitter;

            // Add to decoration positions
            texturePositions[texture.uid].positions![
                texturePositions[texture.uid].length
            ] = x;
            texturePositions[texture.uid].positions![
                texturePositions[texture.uid].length + 1
            ] = y;
            texturePositions[texture.uid].positions![
                texturePositions[texture.uid].length + 2
            ] = elevation;
            texturePositions[texture.uid].length += 3;
        }
    }
    return texturePositions;
}

async function drawShaderTextures({
    shaderName,
    shaderTextures,
    renderOrder,
    numGeometries,
    stage,
}: {
    shaderName: string;
    shaderTextures: Record<string, ShaderTexture>;
    renderOrder: number;
    numGeometries: number;
    stage: Container;
}) {
    for (const [
        textureUid,
        { texture, positions, width, height, length },
    ] of Object.entries(shaderTextures)) {
        const [shader, { geometry, instancePositions }] = loadShaderGeometry(
            shaderName,
            texture,
            width,
            height,
            {
                instanceCount: numGeometries,
                zScale: Z_SCALE,
            },
        );

        // Set geometry instance count
        geometry.instanceCount = length / 3; // x, y, elevation

        // Update instance positions buffer
        if (instancePositions && positions != null) {
            instancePositions.data.set(positions);
            instancePositions.update();
        }

        const meshUid = `${shaderName}-${textureUid}`;
        if (instancedShaderMeshes[meshUid] == null) {
            const mesh = new Mesh<Geometry, Shader>({ geometry, shader });
            mesh.zIndex = renderOrder;
            instancedShaderMeshes[meshUid] = mesh;
            stage.addChild(mesh);
        }
    }
}

function clearInstancedShaderMeshes(stage: Container) {
    for (const mesh of Object.values(instancedShaderMeshes)) {
        stage.removeChild(mesh);
        mesh.destroy();
    }
    instancedShaderMeshes = {};
}
