import { getWorldsAtLocation } from "$lib/crossover/game";
import type { World } from "$lib/crossover/types";
import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { type GeohashLocation } from "$lib/crossover/world/types";
import { seededRandom, stringToRandomNumber } from "$lib/utils/random";
import { Assets, Container } from "pixi.js";
import { createNoise2D } from "simplex-noise";
import { WorldEntityContainer } from "./entities/WorldEntityContainer";
import {
    calculatePosition,
    getImageForTile,
    getTilesetForTile,
    type Location,
    type Position,
} from "./utils";

export {
    drawWorldsAtLocation,
    garbageCollectWorldECs,
    loadWorldECs,
    noise2D,
    worldEntityContainers,
};

// Simplex noise function
const noise2D = createNoise2D(() => {
    return seededRandom(stringToRandomNumber(worldSeed.name));
});

let worldEntityContainers: Record<string, WorldEntityContainer> = {};

async function drawWorldsAtLocation(
    {
        geohash,
        locationInstance,
        locationType,
    }: {
        geohash: string;
        locationInstance: string;
        locationType: GeohashLocation;
    },
    stage: Container,
) {
    const worlds = await getWorldsAtLocation({
        geohash,
        locationInstance,
        locationType,
    });

    // Load worlds
    for (const [worldId, world] of Object.entries(worlds)) {
        // Origin is at top left
        const origin = autoCorrectGeohashPrecision(
            world.loc[0],
            worldSeed.spatial.unit.precision,
        );
        await loadWorldECs({
            world,
            origin: await calculatePosition(
                origin,
                world.locT as GeohashLocation,
                LOCATION_INSTANCE, // worlds are the same in all instances
            ),
            stage,
        });
    }
}

async function loadWorldECs({
    world,
    origin,
    stage,
}: {
    world: World;
    origin: Position;
    stage: Container;
}) {
    const tilemap = await Assets.load(world.uri);
    const { layers: tileMapLayers, tilesets, tileheight, tilewidth } = tilemap;

    // Note: We need to align the tiled editor's tile (anchor at bottom-left) to the game's tile center (center)
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
                const tileEntityId = `${world.world}-${tileId}-${i}-${j}`;

                // Skip if already created
                if (tileEntityId in worldEntityContainers) {
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
                    world,
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
                    tileId: tileEntityId,
                });

                worldEntityContainers[tileEntityId] = ec;

                ec.setIsoPosition({
                    row: origin.row + i,
                    col: origin.col + j,
                    elevation: origin.elevation,
                });

                // Add to stage
                stage.addChild(ec);
            }
        }
    }
}

function garbageCollectWorldECs({
    geohash,
    locationInstance,
    locationType,
}: Location) {
    const town = geohash.slice(0, worldSeed.spatial.town.precision);
    for (const [id, ec] of Object.entries(worldEntityContainers)) {
        if (
            !ec.world ||
            ec.world.locI !== locationInstance ||
            ec.world.locT !== locationType ||
            !ec.world.loc[0].startsWith(town)
        ) {
            ec.destroy();
            delete worldEntityContainers[id];
        }
    }
}
