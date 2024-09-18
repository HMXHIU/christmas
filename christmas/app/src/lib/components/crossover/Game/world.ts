import { isGeohashTraversableClient } from "$lib/crossover/game";
import type { World } from "$lib/crossover/types";
import {
    autoCorrectGeohashPrecision,
    getAllUnitGeohashes,
} from "$lib/crossover/utils";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { worldSeed } from "$lib/crossover/world/settings/world";
import {
    geohashLocationTypes,
    type GeohashLocationType,
} from "$lib/crossover/world/types";
import { seededRandom, stringToRandomNumber } from "$lib/utils";
import { Assets, Container, Graphics } from "pixi.js";
import { createNoise2D } from "simplex-noise";
import { get } from "svelte/store";
import { itemRecord, worldRecord } from "../../../../store";
import { WorldEntityContainer } from "./entities/WorldEntityContainer";
import {
    calculatePosition,
    getImageForTile,
    getTilesetForTile,
    type Position,
} from "./utils";

export {
    cullAllWorldEntityContainers,
    debugWorld,
    drawWorlds,
    garbageCollectWorldEntityContainers,
    loadWorld,
    noise2D,
    worldEntityContainers,
};

// Simplex noise function
const noise2D = createNoise2D(() => {
    return seededRandom(stringToRandomNumber(worldSeed.name));
});

let worldEntityContainers: Record<string, WorldEntityContainer> = {};
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
                    LOCATION_INSTANCE, // worlds are the same in all instances
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
    if (worldEntityContainers[world.world]) {
        return;
    }
    const tilemap = await Assets.load(world.url);
    const { layers: tileMapLayers, tilesets, tileheight, tilewidth } = tilemap;

    // Note: we need to align the tiled editor's tile (anchor at bottom-left) to the game's tile center (center)
    const tileOffsetX = -tilewidth / 2; // move left
    const tileOffsetY = tileheight / 2; // move down

    for (const layer of tileMapLayers) {
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
                if (worldId in worldEntityContainers) {
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

                const ec = new WorldEntityContainer({
                    texture,
                    layer: renderLayer,
                    cellHeight: 1,
                    imageHeight: imageheight,
                    imageWidth: imagewidth,
                    tileHeight: tileheight,
                    tileWidth: tilewidth,
                    tileOffset: { x: tileOffsetX, y: tileOffsetY },
                    layerOffset: { x: layerOffsetX, y: layerOffsetY },
                    textureOffset: { x: tileSetOffsetX, y: tileSetOffsetY },
                    tileId: worldId,
                });

                worldEntityContainers[worldId] = ec;

                ec.setIsoPosition({
                    row: position.row + i,
                    col: position.col + j,
                    elevation: position.elevation,
                });

                // // Debug bounds
                // if (ec.mesh && renderLayer === "entity") {
                //     stage.addChild(debugBounds(ec, 0xffff00));
                // }

                // Add to stage
                if (!stage.children.includes(ec)) {
                    stage.addChild(ec);
                }
            }
        }
    }
}

async function debugWorld(stage: Container) {
    const locationInstance = LOCATION_INSTANCE; // worlds are the same in all instances

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
                    item.locI,
                ))
            ) {
                const itemPosition = await calculatePosition(
                    loc,
                    item.locT as GeohashLocationType,
                    locationInstance,
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
                locationInstance,
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
                            "", // World instances are the same across all instances
                        ))
                    ) {
                        const pos = await calculatePosition(
                            loc,
                            world.locT as GeohashLocationType,
                            locationInstance,
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

function garbageCollectWorldEntityContainers(playerPosition: Position) {
    // Cull world meshes outside town
    const town = playerPosition.geohash.slice(
        0,
        worldSeed.spatial.town.precision,
    );
    for (const [id, ec] of Object.entries(worldEntityContainers)) {
        if (!id.startsWith(town)) {
            ec.destroy();
            delete worldEntityContainers[id];
        }
    }
}

function cullAllWorldEntityContainers() {
    for (const [id, ec] of Object.entries(worldEntityContainers)) {
        ec.destroy();
        delete worldEntityContainers[id];
    }
}
