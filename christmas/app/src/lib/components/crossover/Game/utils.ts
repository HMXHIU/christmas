import { PUBLIC_MINIO_ENDPOINT } from "$env/static/public";
import {
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "$lib/crossover/caches";
import { geohashToColRow, geohashToGridCell } from "$lib/crossover/utils";
import type { Ability } from "$lib/crossover/world/abilities";
import type { Action } from "$lib/crossover/world/actions";
import { avatarMorphologies } from "$lib/crossover/world/bestiary";
import { elevationAtGeohash } from "$lib/crossover/world/biomes";
import type {
    AssetMetadata,
    GeohashLocation,
} from "$lib/crossover/world/types";
import type { Tileset } from "$lib/crossover/world/world";
import { seededRandom } from "$lib/utils";
import { gsap } from "gsap";
import { PixiPlugin } from "gsap/PixiPlugin";
import * as PIXI from "pixi.js";
import {
    Assets,
    Container,
    Graphics,
    Mesh,
    Sprite,
    type ColorSource,
    type Geometry,
    type Shader,
    type Texture,
} from "pixi.js";
import { get } from "svelte/store";
import { landGrading, player, worldOffset } from "../../../../store";
import type { AnimationMetadata, AvatarMetadata } from "../avatar/types";
import { entityContainers } from "./entities";
import {
    CELL_HEIGHT,
    CELL_WIDTH,
    ELEVATION_TO_CELL_HEIGHT,
    GRID_MID_COL,
    GRID_MID_ROW,
    HALF_ISO_CELL_HEIGHT,
    HALF_ISO_CELL_WIDTH,
} from "./settings";

export {
    calculatePosition,
    calculateRowColFromIso,
    cartToIso,
    debugBounds,
    decodeTiledSource,
    destroyContainer,
    getAngle,
    getAvatarMetadata,
    getImageForTile,
    getPathHighlights,
    getPlayerPosition,
    getTilesetForTile,
    initAssetManager,
    isCellInView,
    isoToCart,
    loadAssetTexture,
    positionsInRange,
    registerGSAP,
    scaleToFitAndMaintainAspectRatio,
    snapToGrid,
    WORLD_COL_MAX,
    WORLD_ISOY_MAX,
    WORLD_ROW_MAX,
    type Position,
};

const [WORLD_COL_MAX, WORLD_ROW_MAX] = geohashToColRow("pbzupuzv");

const WORLD_ISOY_MAX = cartToIso(
    WORLD_COL_MAX * CELL_WIDTH,
    WORLD_ROW_MAX * CELL_WIDTH,
)[1]; // 33093136

interface Position {
    row: number;
    col: number;
    isoX: number;
    isoY: number;
    geohash: string;
    locationType: GeohashLocation;
    locationInstance: string;
    precision: number;
    elevation: number;
}

async function calculatePosition(
    geohash: string,
    locationType: GeohashLocation,
    locationInstance: string,
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
        (await elevationAtGeohash(geohash, locationType, {
            responseCache: topologyResponseCache,
            resultsCache: topologyResultCache,
            bufferCache: topologyBufferCache,
            landGrading: get(landGrading),
        }));

    return {
        row,
        col,
        isoX,
        isoY,
        geohash,
        precision,
        elevation,
        locationType,
        locationInstance,
    };
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

function snapToGrid(
    x: number,
    y: number,
    snapX: number,
    snapY: number,
): [number, number] {
    return [Math.round(x / snapX) * snapX, Math.round(y / snapY) * snapY];
}

/**
 * Rotate clockwise by 45 degrees, scale vertically by 0.5
 * An offset is needed to ensure no large numbers which causes floating point errors
 *
 * [x, y] * [ 0.5  0.25 ]
 *          [ -0.5 0.25 ]
 */
function cartToIso(
    x: number,
    y: number,
    snap?: {
        x: number;
        y: number;
    },
) {
    const offset = get(worldOffset);

    x -= offset.col * CELL_WIDTH;
    y -= offset.row * CELL_HEIGHT;

    if (snap != null) {
        return snapToGrid(
            x * 0.5 + y * -0.5,
            x * 0.25 + y * 0.25,
            snap.x,
            snap.y,
        );
    }

    return [x * 0.5 + y * -0.5, x * 0.25 + y * 0.25];
}

function isoToCart(x: number, y: number) {
    const [cartX, cartY] = [x * 1 + y * 2, x * -1 + y * 2];
    const offset = get(worldOffset);
    return [cartX + offset.col * CELL_WIDTH, cartY + offset.row * CELL_HEIGHT];
}

function calculateRowColFromIso(isoX: number, isoY: number): [number, number] {
    const [cartX, cartY] = isoToCart(isoX, isoY);
    const col = Math.round(cartX / CELL_WIDTH);
    const row = Math.round(cartY / CELL_HEIGHT);
    return [row, col];
}

async function loadAssetTexture(
    asset: AssetMetadata,
    { variant, seed }: { variant?: string; seed?: number } = {},
): Promise<Texture | null> {
    seed ??= 0;

    // Asset path is a url to a texture
    if (asset.path.startsWith("http")) {
        return await Assets.load(asset.path);
    }

    // Asset path is a pixijs bundle (spritesheet or image)
    const [bundleName, alias] = asset.path.split("/").slice(-2);
    const bundle = await Assets.loadBundle(bundleName);

    // Determine variant
    if (variant == null) {
        if (asset.probability != null) {
            const rv = seededRandom(seed);
            const entries = Object.entries(asset.probability);
            let acc = entries[0][1];
            variant = entries[0][0];
            for (const [v, p] of Object.entries(asset.probability)) {
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

    const frame =
        bundle[alias]?.textures?.[asset.variants?.[variant] || "default"] ||
        bundle[alias];
    return frame || null;
}

function decodeTiledSource(path: string): string {
    // const source = decodeURIComponent(path) // strip '../'
    //     .split("/")
    //     .slice(1)
    //     .join("/");

    // eg. path should be the path in the games bucket (eg. /worlds/tilesets/farm.json)
    return `${PUBLIC_MINIO_ENDPOINT}/game${path}`;
}

async function getTilesetForTile(
    tileId: number,
    sortedTilesets: { firstgid: number; source: string }[],
): Promise<{ firstgid: number; tileset: Tileset }> {
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
    let manifest = await (
        await fetch(`${PUBLIC_MINIO_ENDPOINT}/game/manifest.json`)
    ).json();

    // Load assets in background
    await Assets.init({ manifest, basePath: PUBLIC_MINIO_ENDPOINT });
    Assets.backgroundLoadBundle([
        "biomes",
        "bestiary",
        "props",
        "actions",
        "sound-effects",
        "animation-effects",
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

function debugBounds(c: Container, color?: ColorSource): Container {
    // Add this to the parent of this IsoMesh to debug
    const debugContainer = new Container();
    const { x, y, width, height } = c.getBounds();
    // Draw bounding box
    debugContainer.addChild(
        new Graphics()
            .rect(x, y, width, height)
            .stroke({ color: color ?? 0xff0000 }),
    );
    // Draw origin
    debugContainer.addChild(
        new Graphics().circle(c.x, c.y, 5).fill({ color: color ?? 0xff0000 }),
    );

    return debugContainer;
}
