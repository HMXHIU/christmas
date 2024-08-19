import {
    autoCorrectGeohashPrecision,
    cartToIso,
    getAllUnitGeohashes,
} from "$lib/crossover/utils";
import { worldSeed } from "$lib/crossover/world/settings/world";
import {
    geohashLocationTypes,
    type GeohashLocationType,
} from "$lib/crossover/world/types";
import type { World } from "$lib/server/crossover/redis/entities";
import { Assets, Container, Graphics } from "pixi.js";
import { get } from "svelte/store";
import { itemRecord, worldRecord } from "../../../../store";
import { IsoMesh } from "../shaders/IsoMesh";
import {
    calculatePosition,
    CELL_WIDTH,
    getImageForTile,
    getTilesetForTile,
    isGeohashTraversableClient,
    RENDER_ORDER,
    Z_OFF,
    Z_SCALE,
    type Position,
} from "./utils";

export { cullWorlds, debugWorld, drawWorlds, loadWorld, worldMeshes };

let worldMeshes: Record<string, IsoMesh> = {};
let colliders: Graphics[] = [];

async function drawWorlds(
    worldRecord: Record<string, Record<string, World>>,
    stage: Container,
) {
    // Load worlds
    for (const [town, worlds] of Object.entries(worldRecord)) {
        for (const [worldId, world] of Object.entries(worlds)) {
            // Origin is at top left
            const origin = autoCorrectGeohashPrecision(
                world.loc[0],
                worldSeed.spatial.unit.precision,
            );

            await loadWorld({
                world: world,
                position: await calculatePosition(
                    origin,
                    world.locT as GeohashLocationType,
                ),
                town,
                stage,
            });
        }
    }
}

async function loadWorld({
    world,
    position,
    town,
    stage,
}: {
    world: World;
    town: string;
    position: Position;
    stage: Container;
}) {
    // Skip if alerady loaded
    if (worldMeshes[world.world]) {
        return;
    }

    const tilemap = await Assets.load(world.url);
    const { layers, tilesets, tileheight, tilewidth } = tilemap;

    // Note: we need to align the tiled editor's tile (anchor at bottom-left) to the game's tile center (center)
    const tileOffsetX = -tilewidth / 2; // move left
    const tileOffsetY = tileheight / 2; // move down

    for (const layer of layers) {
        const {
            data, // 1D array of tile indices
            properties,
            offsetx, // in pixels
            offsety,
            width, // in tiles (1 tile might be multiple cells)
            height,
            visible,
        } = layer;

        // Skip of not visible (colliders)
        if (!visible) {
            continue;
        }

        const props: { name: string; value: any; type: string }[] =
            properties ?? [];
        const layerOffsetX = offsetx ?? 0;
        const layerOffsetY = offsety ?? 0;

        // Get properties
        const { layer: renderLayer } = props.reduce(
            (acc: Record<string, any>, { name, value, type }) => {
                acc[name] = value;
                return acc;
            },
            {},
        );

        console.log("renderlayer", renderLayer, Z_OFF[renderLayer]);

        const sortedTilesets = tilesets
            .sort((a: any, b: any) => a.firstgid - b.firstgid)
            .reverse();

        // Create tile sprites
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const tileId = data[i * width + j];
                if (tileId === 0) {
                    continue;
                }
                const worldId = `${town}-${world.world}-${tileId}-${i}-${j}`;

                // Skip if already created
                if (worldId in worldMeshes) {
                    continue;
                }

                // Get tileset for tileId
                const { tileset, firstgid } = await getTilesetForTile(
                    tileId,
                    sortedTilesets,
                );

                const tileSetOffsetX = tileset.tileoffset?.x ?? 0;
                const tileSetOffsetY = tileset.tileoffset?.y ?? 0;

                // Get image for tileId
                const { texture, imageheight, imagewidth } =
                    await getImageForTile(tileset.tiles, tileId - firstgid);

                const xCells = imagewidth / tilewidth;
                const yCells = imageheight / tileheight;

                const mesh = new IsoMesh({
                    shaderName: "world",
                    texture,
                    zOffset: Z_OFF[renderLayer] ?? Z_OFF.world,
                    zScale: Z_SCALE,
                    renderLayer:
                        RENDER_ORDER[renderLayer] ?? RENDER_ORDER.world,
                    cellHeight: 1, // TODO: cant know the cell height by using image height, because the base is not defined
                });
                worldMeshes[worldId] = mesh;

                // Set scale (should be the same for both x and y)
                const screenWidth = xCells * CELL_WIDTH;
                const scale = screenWidth / imagewidth;
                mesh.scale.set(scale, scale);

                const [layerIsoX, layerIsoY] = cartToIso(
                    j * CELL_WIDTH,
                    i * CELL_WIDTH,
                );

                // Note:
                //  - By default the tiled editor uses the bottom-left of an image as the anchor
                //  - In pixi.js the pivot is based on the original size of the texture without scaling
                const anchor = { x: 0, y: 1 };
                const pivotX = anchor.x * imagewidth;
                const pivotY = anchor.y * imageheight;
                mesh.pivot.set(pivotX - tileOffsetX, pivotY - tileOffsetY);

                // Set initial position
                const isoX =
                    layerIsoX +
                    position.isoX +
                    (layerOffsetX + tileSetOffsetX) * scale;

                // Note: keep isoY for setting depth
                const isoY =
                    layerIsoY +
                    position.isoY +
                    (layerOffsetY + tileSetOffsetY) * scale;
                mesh.x = isoX;
                mesh.y = isoY - position.elevation;

                // DEBUG MESH
                stage.addChild(mesh.debugBounds());

                // Update depth (set as center of the bottom grid cell)
                const bounds = mesh.getBounds();
                mesh.updateDepth(isoY);

                // Add to stage
                if (!stage.children.includes(mesh)) {
                    stage.addChild(mesh);
                }
            }
        }
    }
}

async function debugWorld(stage: Container) {
    // Clear colliders
    for (const c of colliders) {
        c.destroy();
    }

    // Draw item colliders
    for (const item of Object.values(get(itemRecord))) {
        if (!geohashLocationTypes.has(item.locT)) continue;
        for (const loc of item.loc) {
            if (
                !(await isGeohashTraversableClient(
                    loc,
                    item.locT as GeohashLocationType,
                ))
            ) {
                const itemPosition = await calculatePosition(
                    loc,
                    item.locT as GeohashLocationType,
                );
                colliders.push(
                    stage.addChild(
                        new Graphics()
                            .circle(
                                itemPosition.isoX,
                                itemPosition.isoY - itemPosition.elevation,
                                5,
                            )
                            .stroke({ color: 0xff0000 }),
                    ),
                );
            }
        }
    }

    // Debug world
    for (const [town, worlds] of Object.entries(get(worldRecord))) {
        for (const world of Object.values(worlds)) {
            if (!geohashLocationTypes.has(world.locT)) continue;

            // Draw world origin
            const origin = autoCorrectGeohashPrecision(
                world.loc[0],
                worldSeed.spatial.unit.precision,
            );
            const originPosition = await calculatePosition(
                origin,
                world.locT as GeohashLocationType,
            );
            colliders.push(
                stage.addChild(
                    new Graphics()
                        .circle(
                            originPosition.isoX,
                            originPosition.isoY - originPosition.elevation,
                            8,
                        )
                        .stroke({ color: 0xff00ff }),
                ),
            );

            for (const plot of world.loc) {
                for (const loc of getAllUnitGeohashes(plot)) {
                    // Draw world colliders
                    if (
                        !(await isGeohashTraversableClient(
                            loc,
                            world.locT as GeohashLocationType,
                        ))
                    ) {
                        const pos = await calculatePosition(
                            loc,
                            world.locT as GeohashLocationType,
                        );
                        colliders.push(
                            stage.addChild(
                                new Graphics()
                                    .circle(
                                        pos.isoX,
                                        pos.isoY - pos.elevation,
                                        5,
                                    )
                                    .stroke({ color: 0xff0000 }),
                            ),
                        );
                    }
                }
            }
        }
    }
}

function cullWorlds(playerPosition: Position) {
    // Cull world meshes outside town
    const town = playerPosition.geohash.slice(
        0,
        worldSeed.spatial.town.precision,
    );
    for (const [id, mesh] of Object.entries(worldMeshes)) {
        if (!id.startsWith(town)) {
            mesh.destroy();
            delete worldMeshes[id];
        }
    }
}
