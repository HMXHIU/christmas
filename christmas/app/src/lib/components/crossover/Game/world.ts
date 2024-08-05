import { autoCorrectGeohashPrecision, cartToIso } from "$lib/crossover/utils";
import { geohashToGridCell } from "$lib/crossover/world/utils";
import { worldSeed } from "$lib/crossover/world/world";
import type { World } from "$lib/server/crossover/redis/entities";
import { Assets, Container, Sprite } from "pixi.js";
import { IsoMesh } from "../shaders/IsoMesh";
import {
    calculatePosition,
    CELL_HEIGHT,
    CELL_WIDTH,
    getImageForTile,
    getPlayerPosition,
    getTilesetForTile,
    ISO_CELL_HEIGHT,
    RENDER_ORDER,
    Z_OFF,
    Z_SCALE,
    type Position,
} from "./utils";

export { cullWorlds, debugColliders, drawWorlds, loadWorld, worldMeshes };

let worldMeshes: Record<string, IsoMesh> = {};

async function drawWorlds(
    worldRecord: Record<string, Record<string, World>>,
    stage: Container,
) {
    const playerPosition = getPlayerPosition();
    if (playerPosition == null) {
        return;
    }

    // Get all worlds in town
    const town = playerPosition.geohash.slice(
        0,
        worldSeed.spatial.town.precision,
    );
    const worldsInTown = worldRecord[town];

    // Town has no worlds
    if (!worldsInTown) {
        return;
    }

    // TODO: this is pretty inefficient we we need to keep loading everytime player moves

    // Load worlds
    for (const w of Object.values(worldsInTown)) {
        const origin = autoCorrectGeohashPrecision(
            w.loc[0],
            worldSeed.spatial.unit.precision,
        );
        await loadWorld({
            world: w,
            position: await calculatePosition(origin),
            town,
            stage,
        });
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
    // await debugColliders(worldStage, $worldRecord);

    const tilemap = await Assets.load(world.url);
    const { layers, tilesets, tileheight, tilewidth } = tilemap;
    const [tileOffsetX, tileOffsetY] = cartToIso(tilewidth / 2, tilewidth / 2);

    for (const layer of layers) {
        const {
            data, // 1D array of tile indices
            properties,
            offsetx, // in pixels
            offsety,
            width, // in tiles (1 tile might be multiple cells)
            height,
            x,
            y,
        } = layer;
        const props: { name: string; value: any; type: string }[] =
            properties ?? [];

        // Get properties
        const { z, collider, interior } = props.reduce(
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
                const id = `${town}-${world.world}-${tileId}-${i}-${j}`;

                // Skip if already created
                if (id in worldMeshes) {
                    continue;
                }

                // Get tileset for tileId
                const { tileset, firstgid } = await getTilesetForTile(
                    tileId,
                    sortedTilesets,
                );

                // Get image for tileId
                const { texture, imageheight, imagewidth } =
                    await getImageForTile(tileset.tiles, tileId - firstgid);

                const [isoX, isoY] = cartToIso(
                    j * tilewidth,
                    i * tilewidth, // use tilewidth for cartesian
                );

                const mesh = new IsoMesh({
                    shaderName: "world",
                    texture,
                    zOffset: Z_OFF[z] ?? Z_OFF.floor,
                    zScale: Z_SCALE,
                    renderLayer: RENDER_ORDER[z] || RENDER_ORDER.world,
                    cellHeight: tileheight / ISO_CELL_HEIGHT,
                });
                worldMeshes[id] = mesh;

                // Center of the bottom tile (imageheight a multiple of tileheight)
                const anchor = {
                    x: 0.5,
                    y: 1 - tileheight / imageheight / 2,
                };

                // Set initial position
                const x =
                    isoX +
                    (offsetx ?? 0) +
                    position.isoX +
                    tileOffsetX -
                    anchor.x * imagewidth;
                const y =
                    isoY +
                    (offsety ?? 0) +
                    position.isoY +
                    tileOffsetY -
                    anchor.y * imageheight;
                mesh.x = x;
                mesh.y = y - position.elevation;

                // Update depth
                mesh.updateDepth(y + imageheight);

                // Add to stage
                if (!stage.children.includes(mesh)) {
                    stage.addChild(mesh);
                }
            }
        }
    }
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
