import { PUBLIC_TILED_MINIO_BUCKET } from "$env/static/public";
import {
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
    worldAssetMetadataCache,
    worldTraversableCellsCache,
} from "$lib/components/crossover/Game/caches";
import { aStarPathfinding } from "$lib/crossover/pathfinding";
import {
    cartToIso,
    geohashToGridCell,
    gridCellToGeohash,
    isoToCart,
    seededRandom,
} from "$lib/crossover/utils";
import type { Ability } from "$lib/crossover/world/abilities";
import type { Action } from "$lib/crossover/world/actions";
import { avatarMorphologies } from "$lib/crossover/world/bestiary";
import { elevationAtGeohash } from "$lib/crossover/world/biomes";
import { worldSeed } from "$lib/crossover/world/settings/world";
import type { AssetMetadata, Direction } from "$lib/crossover/world/types";
import { isGeohashTraversable } from "$lib/crossover/world/utils";
import type { World } from "$lib/server/crossover/redis/entities";
import { gsap } from "gsap";
import { PixiPlugin } from "gsap/PixiPlugin";
import * as PIXI from "pixi.js";
import {
    Assets,
    Container,
    Mesh,
    Sprite,
    type Geometry,
    type Shader,
    type Texture,
} from "pixi.js";
import { get } from "svelte/store";
import { itemRecord, player, worldRecord } from "../../../../store";
import type { AnimationMetadata, AvatarMetadata } from "../avatar/types";
import { entityContainers } from "./entities";

export {
    calculatePosition,
    calculateRowColFromIso,
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    CELL_HEIGHT,
    CELL_WIDTH,
    decodeTiledSource,
    destroyContainer,
    ELEVATION_TO_CELL_HEIGHT,
    getAngle,
    getAvatarMetadata,
    getDirectionsToPosition,
    getImageForTile,
    getPathHighlights,
    getPlayerPosition,
    getTilesetForTile,
    GRID_MID_COL,
    GRID_MID_ROW,
    HALF_ISO_CELL_HEIGHT,
    HALF_ISO_CELL_WIDTH,
    initAssetManager,
    isCellInView,
    isGeohashTraversableClient,
    ISO_CELL_HEIGHT,
    ISO_CELL_WIDTH,
    loadAssetTexture,
    positionsInRange,
    registerGSAP,
    RENDER_ORDER,
    scaleToFitAndMaintainAspectRatio,
    WORLD_HEIGHT,
    WORLD_WIDTH,
    Z_LAYER,
    Z_OFF,
    Z_SCALE,
    type Position,
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

// Note: this are cartesian coordinates (CELL_HEIGHT = CELL_WIDTH;)
const CELL_WIDTH = 96; // 64, 96, 128
const CELL_HEIGHT = CELL_WIDTH;
const ISO_CELL_WIDTH = CELL_WIDTH;
const ISO_CELL_HEIGHT = CELL_HEIGHT / 2;
const HALF_ISO_CELL_WIDTH = ISO_CELL_WIDTH / 2;
const HALF_ISO_CELL_HEIGHT = ISO_CELL_HEIGHT / 2;
const CANVAS_ROWS = 9;
const CANVAS_COLS = 9;
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

    // Action bubble
    icon: 0,

    // draw last because it has alpha
    item: 1,
    grass: 2,
    player: 1,
    monster: 1,
    world: 1,
    effects: 3,
};

// In WebGL, the gl_Position.z value should be in the range [-1 (closer), 1]
const ELEVATION_TO_CELL_HEIGHT = CELL_HEIGHT / 2 / 8; // 1 meter = 1/8 a cell elevation (on isometric coordinates)

/*
 * Depth test scaling and offsets
 * Note: Map the range from [-1, 1] to [-0.5, 0.5], then in the shader add 0.5 to map it to [0, 1]
 *       Leave [-1, 0] alone so that we can display sprites above the depth tested meshes
 */
const { row: bottomRightRow, col: bottomRightCol } =
    geohashToGridCell("pbzupuzv");
const Z_SCALE =
    -1 /
    (4 *
        cartToIso(
            bottomRightCol * CELL_WIDTH,
            bottomRightRow * CELL_HEIGHT,
        )[1]);

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

async function getTraversalCost(row: number, col: number): Promise<number> {
    // 0 is walkable, 1 is not
    return (await isGeohashTraversableClient(
        gridCellToGeohash({
            col,
            row,
            precision: worldSeed.spatial.unit.precision,
        }),
    ))
        ? 0
        : 1;
}

async function getDirectionsToPosition(
    source: { row: number; col: number },
    target: { row: number; col: number },
    range?: number,
): Promise<Direction[]> {
    return await aStarPathfinding({
        colStart: source.col,
        rowStart: source.row,
        colEnd: target.col,
        rowEnd: target.row,
        range,
        getTraversalCost,
    });
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

    // Asset is a url to a texture
    if (asset.path.startsWith("http")) {
        return await Assets.load(asset.path);
    }

    // Asset uses a pixijs bundle (spritesheet or image)
    const [bundleName, alias] = asset.path.split("/").slice(-2);
    const bundle = await Assets.loadBundle(bundleName);

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
        "sound-effects",
    ]);
}

function registerGSAP() {
    // Register GSAP PixiPlugin
    gsap.registerPlugin(PixiPlugin);

    // Configure PixiPlugin for Pixi.js v8
    PixiPlugin.registerPIXI(PIXI);
}

function destroyContainer(thing: Sprite | Mesh<Geometry, Shader> | Container) {
    // Destroy children
    for (const child of thing.children) {
        destroyContainer(child);
    }

    // Remove from parent
    if (thing.parent) {
        thing.parent.removeChild(thing);
    }

    // Destroy self
    thing.eventMode = "none";
    thing.removeAllListeners();
    thing.destroy();
}

function positionsInRange(
    action: Action | Ability,
    { row, col }: { row: number; col: number },
): Record<string, number> {
    const highlightPositions: Record<string, number> = {};
    for (let i = row - action.range; i <= row + action.range; i++) {
        for (let j = col - action.range; j <= col + action.range; j++) {
            const [x, y] = cartToIso(j * CELL_WIDTH, i * CELL_HEIGHT, {
                x: HALF_ISO_CELL_WIDTH,
                y: HALF_ISO_CELL_HEIGHT,
            });
            highlightPositions[`${x},${y}`] = 2;
        }
    }
    return highlightPositions;
}

function getAngle(h: number, k: number, x: number, y: number): number {
    const dx = x - h;
    const dy = y - k;
    return Math.atan2(dy, dx);
}

function scaleToFitAndMaintainAspectRatio(
    w: number,
    h: number,
    targetWidth: number,
    targetHeight: number,
): { width: number; height: number; scale: number } {
    const aspectRatio = w / h;
    const targetAspectRatio = targetWidth / targetHeight;

    let scale: number;
    let newWidth: number;
    let newHeight: number;

    if (aspectRatio > targetAspectRatio) {
        // Width is the limiting factor
        scale = targetWidth / w;
    } else {
        // Height is the limiting factor
        scale = targetHeight / h;
    }

    // Calculate new dimensions
    newWidth = w * scale;
    newHeight = h * scale;

    return { width: newWidth, height: newHeight, scale };
}

function getPathHighlights(
    pathPositions: { row: number; col: number }[],
    highlight: number,
) {
    const highlights = Object.fromEntries(
        pathPositions.map(({ row, col }) => {
            const [x, y] = cartToIso(col * CELL_WIDTH, row * CELL_HEIGHT, {
                x: HALF_ISO_CELL_WIDTH,
                y: HALF_ISO_CELL_HEIGHT,
            });
            return [`${x},${y}`, highlight];
        }),
    );

    return highlights;
}

function getPlayerPosition(): Position | null {
    const p = get(player);
    return p?.player ? entityContainers[p.player]?.isoPosition : null;
}

// TODO: support monster
async function getAvatarMetadata(
    url: string,
): Promise<{ avatar: AvatarMetadata; animation: AnimationMetadata }> {
    // this casues issues with asset bundle not initialized
    // const avatar = await Assets.load(avatarMorphologies.humanoid.avatar);
    // const animation = await Assets.load(avatarMorphologies.humanoid.animation);

    const avatar = await (
        await fetch(avatarMorphologies.humanoid.avatar)
    ).json();
    const animation = await (
        await fetch(avatarMorphologies.humanoid.animation)
    ).json();

    try {
        const response = await fetch(url);
        return {
            animation,
            avatar: {
                ...avatar,
                textures: {
                    ...avatar.textures,
                    // override with avatar textures
                    ...(await response.json()),
                },
            },
        };
    } catch (error) {
        console.error(`Failed to get avatar metadata for ${url}`);
        return {
            avatar,
            animation,
        };
    }
}

async function hasColliders(geohash: string): Promise<boolean> {
    for (const item of Object.values(get(itemRecord))) {
        if (item.locT === "geohash" && item.loc.includes(geohash)) {
            return true;
        }
    }
    return false;
}

async function getWorldForGeohash(geohash: string): Promise<World | undefined> {
    for (const worlds of Object.values(get(worldRecord))) {
        for (const world of Object.values(worlds)) {
            if (geohash.startsWith(world.loc[0])) {
                return world;
            }
        }
    }
    return undefined;
}

async function isGeohashTraversableClient(geohash: string): Promise<boolean> {
    return isGeohashTraversable(geohash, hasColliders, getWorldForGeohash, {
        topologyResponseCache,
        topologyResultCache,
        topologyBufferCache,
        worldAssetMetadataCache,
        worldTraversableCellsCache,
    });
}
