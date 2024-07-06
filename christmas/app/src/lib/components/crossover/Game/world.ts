import { autoCorrectGeohashPrecision, cartToIso } from "$lib/crossover/utils";
import { geohashToGridCell } from "$lib/crossover/world/utils";
import { worldSeed } from "$lib/crossover/world/world";
import type { World } from "$lib/server/crossover/redis/entities";
import { Assets, Container, Geometry, Mesh, Shader, Sprite } from "pixi.js";
import { loadShaderGeometry } from "../shaders";
import {
    calculatePosition,
    CELL_HEIGHT,
    CELL_WIDTH,
    getImageForTile,
    getTilesetForTile,
    ISO_CELL_HEIGHT,
    RENDER_ORDER,
    Z_OFF,
    Z_SCALE,
    type EntityMesh,
    type Position,
} from "./utils";

export { debugColliders, drawWorlds, loadWorld };

let worldMeshes: Record<string, EntityMesh> = {};

async function drawWorlds(
    worldRecord: Record<string, Record<string, World>>,
    playerPosition: Position,
    stage: Container,
) {
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

                const shaderGeometry = loadShaderGeometry(
                    "world",
                    texture,
                    imagewidth,
                    imageheight,
                    {
                        // Note: anchor is not used in entity meshes shader
                        uid: id,
                        zScale: Z_SCALE,
                        zOffset: Z_OFF[z] ?? Z_OFF.floor,
                        cellHeight: tileheight / ISO_CELL_HEIGHT,
                    },
                );

                const mesh = new Mesh<Geometry, Shader>({
                    geometry: shaderGeometry.geometry,
                    shader: shaderGeometry.shader,
                });

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
                mesh.zIndex = RENDER_ORDER[z] || RENDER_ORDER.world;

                const instancePositions =
                    shaderGeometry.geometry.getBuffer("aInstancePosition");
                instancePositions.data.set([
                    x,
                    y + imageheight, // this is only used to calculate z
                    position.elevation, // this is not used to calculate z
                ]);
                instancePositions.update();

                // Add to worldMeshes
                const worldMesh = {
                    id,
                    mesh,
                    shaderGeometry,
                    hitbox: new Container(), // Not used for world meshes
                    position: position, // Not used for world meshes
                };

                worldMeshes[id] = worldMesh;

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
