import type { CacheInterface } from "$lib/caches";
import type { World } from "$lib/crossover/types";
import type { NPCs } from "$lib/server/crossover/npc/types";
import { omit } from "lodash-es";
import {
    autoCorrectGeohashPrecision,
    geohashDistance,
    geohashToColRow,
    gridCellToGeohash,
} from "../utils";
import type { BiomeParameters } from "./biomes";
import { TILE_HEIGHT, TILE_WIDTH } from "./settings";
import { fetchSanctuaries, worldSeed } from "./settings/world";
import type { ObjectLayer, TileLayer, WorldAssetMetadata } from "./types";

export {
    findClosestSanctuary,
    poisInWorld,
    traversableCellsInWorld,
    traversableSpeedInWorld,
    type Sanctuary,
    type Spatial,
    type Tileset,
    type WorldPOIs,
    type WorldSeed,
};

interface Sanctuary {
    name: string;
    description: string;
    region: string; // SGP, USA, AUS, etc.
    geohash: string; // unit precision respawn point
}

type Spatial =
    | "continent"
    | "territory"
    | "region"
    | "city"
    | "town"
    | "village"
    | "house"
    | "unit";

interface WorldSeed {
    name: string;
    description: string;
    constants: {
        monsterLimit: Record<string, number>;
    };
    spatial: Record<Spatial, { precision: number }>;
    seeds: {
        continent: {
            [key: string]: {
                biome: BiomeParameters;
                weather: {
                    baseTemperature: number;
                    temperatureVariation: number;
                    rainProbability: number;
                    stormProbability: number;
                };
            };
        };
    };
    time: {
        dayLengthHours: number;
        yearLengthDays: number;
        seasonLengthDays: number;
    };
}

interface Tileset {
    columns: number;
    grid: {
        height: number;
        orientation: string;
        width: number;
    };
    margin: number;
    name: string;
    objectalignment: string;
    spacing: number;
    tilecount: number;
    tiledversion: string;
    tileheight: number;
    tileoffset?: {
        x: number;
        y: number;
    };
    tiles: Array<{
        id: number;
        image: string;
        imageheight: number;
        imagewidth: number;
    }>;
    tilewidth: number;
    type: string;
    version: string;
}

async function findClosestSanctuary(geohash: string): Promise<Sanctuary> {
    const ss = await fetchSanctuaries();
    let closest: Sanctuary = ss[0];
    let distance = Infinity;
    for (const s of ss) {
        const d = geohashDistance(geohash, s.geohash);
        if (d < distance) {
            distance = d;
            closest = s;
        }
    }
    return closest;
}

async function fetchWorldMetadata(
    world: World,
    worldAssetMetadataCache?: CacheInterface,
): Promise<WorldAssetMetadata> {
    const cachedResult = await worldAssetMetadataCache?.get(world.uri);
    if (cachedResult) {
        return cachedResult;
    }
    const metadata = await (await fetch(world.uri)).json();
    if (worldAssetMetadataCache) {
        await worldAssetMetadataCache.set(world.uri, metadata);
    }
    return metadata;
}

async function traversableSpeedInWorld({
    world,
    geohash,
    tileHeight,
    tileWidth,
    worldAssetMetadataCache,
    worldTraversableCellsCache,
}: {
    world: World;
    geohash: string;
    tileHeight?: number;
    tileWidth?: number;
    worldAssetMetadataCache?: CacheInterface;
    worldTraversableCellsCache?: CacheInterface;
}): Promise<number | undefined> {
    const traversableCells = await traversableCellsInWorld({
        world,
        tileHeight: tileHeight ?? TILE_HEIGHT,
        tileWidth: tileWidth ?? TILE_WIDTH,
        worldAssetMetadataCache,
        worldTraversableCellsCache,
    });

    // Top left of world
    const worldOrigin = autoCorrectGeohashPrecision(
        world.loc[0],
        worldSeed.spatial.unit.precision,
    );
    const [worldOriginCol, worldOriginRow] = geohashToColRow(worldOrigin);
    const [col, row] = geohashToColRow(geohash);

    return traversableCells[`${col - worldOriginCol},${row - worldOriginRow}`];
}

async function traversableCellsInWorld({
    world,
    tileWidth,
    tileHeight,
    worldAssetMetadataCache,
    worldTraversableCellsCache,
}: {
    world: World;
    tileWidth: number;
    tileHeight: number;
    worldAssetMetadataCache?: CacheInterface;
    worldTraversableCellsCache?: CacheInterface;
}): Promise<Record<string, number>> {
    const cachedResult = await worldTraversableCellsCache?.get(world.uri);
    if (cachedResult) {
        return cachedResult;
    }
    const asset = await fetchWorldMetadata(world, worldAssetMetadataCache);
    let { layers, tileheight, tilewidth } = asset;

    // Get tilelayers
    layers = layers.filter((l) => l.type === "tilelayer");

    const heightMultiplier = tileheight / tileHeight;
    const widthMultiplier = tilewidth / tileWidth;

    let traversableCells: Record<string, number> = {};
    for (const { data, properties, width, height } of layers as TileLayer[]) {
        if (properties == null) {
            continue;
        }
        for (const { name, value } of properties) {
            if (name === "traversableSpeed") {
                // Outer row
                let outerRow = { row: 0, col: 0 };
                for (let i = 0; i < height; i++) {
                    // Outer col
                    let outerCol = outerRow;
                    for (let j = 0; j < width; j++) {
                        if (data[i * width + j] !== 0) {
                            // Inner row
                            let innerRow = outerCol;
                            for (let m = 0; m < heightMultiplier; m++) {
                                // Inner col
                                let innerCol = innerRow;
                                for (let n = 0; n < widthMultiplier; n++) {
                                    traversableCells[
                                        `${innerCol.col},${innerCol.row}`
                                    ] = value;
                                    innerCol = {
                                        row: innerCol.row,
                                        col: innerCol.col + 1,
                                    };
                                }
                                innerRow = {
                                    row: innerRow.row + 1,
                                    col: innerRow.col,
                                };
                            }
                        }
                        outerCol = {
                            row: outerCol.row,
                            col: outerCol.col + widthMultiplier,
                        };
                    }
                    outerRow = {
                        row: outerRow.row + heightMultiplier,
                        col: outerRow.col,
                    };
                }
            }
        }
    }

    if (worldTraversableCellsCache) {
        worldTraversableCellsCache.set(world.uri, traversableCells);
    }

    return traversableCells;
}

interface SpawnItemPOI {
    prop: string;
    geohash: string;
    variables: Record<string, string | number | boolean>;
}

interface SpawnMonsterPOI {
    beast: string;
    geohash: string;
}

interface SpawnNPCPOI {
    npc: NPCs;
    geohash: string;
}

interface SpawnPlayerPOI {
    geohash: string;
    spawn: "player";
}

type WorldPOIs = (
    | SpawnItemPOI
    | SpawnMonsterPOI
    | SpawnPlayerPOI
    | SpawnNPCPOI
)[];

/**
 * WorldPOIs in the world are added via an object layer in the tiled map editor
 * `spawnWorldPOIs` will get the WorldPOIs and spawn the actual entities
 *
 * Properties in the object layer (configured in the tiled map editor) are used to configure the following:
 *
 *      beast: If defined, indicates a SpawnMonsterPOI and the beast to spawn
 *      prop: If defined, indicates a SpawnItemPOI and the prop to spawn
 *      spawn: If defined with value "player", indicates a SpawnPlayerPOI where the player will spawn upon entering the world
 *      [k:v]: If prop is defined, all other fields will be considered item variables (tiled uses a flat structure there is no nesting)
 *
 * Variable substitution for item variables is performed during `spawnWorldPOIs` with the following properties:
 *
 *      source: The entity (ItemEntity | PlayerEntity) which spawned the world.
 *              We can use this to create an exit by creating a portal which targets the source
 */
async function poisInWorld(
    world: World,
    options?: {
        worldAssetMetadataCache?: CacheInterface;
        worldPOIsCache?: CacheInterface;
    },
): Promise<WorldPOIs> {
    // Get from cache
    const cacheKey = world.uri;
    const cached = await options?.worldPOIsCache?.get(cacheKey);
    if (cached) return cached;

    const pois: WorldPOIs = [];

    const asset = await fetchWorldMetadata(
        world,
        options?.worldAssetMetadataCache,
    );
    let { layers, tileheight, tilewidth } = asset;

    /* 
    In the tiled map editor x, y are long the isometric axis 
    +x means increasing bottom right, +y means increasing bottom left
    */
    const unitTile = Math.sqrt((tilewidth / 2) ** 2 + (tileheight / 2) ** 2);

    // Get objectgroup
    layers = layers.filter((l) => l.type === "objectgroup");

    for (const { objects } of layers as ObjectLayer[]) {
        for (const obj of objects) {
            if (obj.point) {
                // Get object properties
                const properties = obj.properties.reduce(
                    (acc: Record<string, any>, { name, value, type }) => {
                        acc[name] = value;
                        return acc;
                    },
                    {},
                );

                // Convert x, y to geohash
                const cols = Math.round(obj.x / unitTile);
                const rows = Math.round(obj.y / unitTile);
                const originGeohash = autoCorrectGeohashPrecision(
                    world.loc[0],
                    worldSeed.spatial.unit.precision,
                );
                const [oCol, oRow] = geohashToColRow(originGeohash);
                const geohash = gridCellToGeohash({
                    row: oRow + rows,
                    col: oCol + cols,
                    precision: worldSeed.spatial.unit.precision,
                });

                // Note: A POI can implement multiple POI interfaces (hence `if` not `else if`)

                // Item poi
                if (properties.prop) {
                    pois.push({
                        prop: properties.prop,
                        geohash,
                        variables: omit(properties, "prop"), // for items, everything other than `prop` is a variable
                    });
                }

                // Monster poi
                if (properties.beast) {
                    pois.push({
                        beast: properties.beast,
                        geohash,
                    });
                }

                // NPC poi
                if (properties.npc) {
                    pois.push({
                        npc: properties.npc,
                        geohash,
                    });
                }

                // Player spawn poi
                if (properties.spawn === "player") {
                    pois.push({
                        spawn: "player",
                        geohash,
                    });
                }
            }
        }
    }

    // Set cache
    if (options?.worldPOIsCache) {
        await options.worldPOIsCache.set(cacheKey, pois);
    }

    return pois;
}
