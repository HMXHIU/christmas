import type { CacheInterface } from "$lib/caches";
import type { World } from "$lib/server/crossover/redis/entities";
import {
    autoCorrectGeohashPrecision,
    geohashToColRow,
    gridCellToGeohash,
} from "../utils";
import type { BiomeParameters } from "./biomes";
import { TILE_HEIGHT, TILE_WIDTH } from "./settings";
import { worldSeed } from "./settings/world";
import type { ObjectLayer, TileLayer, WorldAssetMetadata } from "./types";

export {
    poisInWorld,
    traversableCellsInWorld,
    traversableSpeedInWorld,
    type Sanctuary,
    type Tileset,
    type WorldSeed,
};

interface Sanctuary {
    name: string;
    description: string;
    region: string; // SGP, USA, AUS, etc.
    geohash: string; // unit precision respawn point
}

interface WorldSeed {
    name: string;
    description: string;
    constants: {
        maxMonstersPerContinent: number;
    };
    spatial: {
        continent: {
            precision: number;
        };
        territory: {
            precision: number;
        };
        region: {
            precision: number;
        };
        city: {
            precision: number;
        };
        town: {
            precision: number;
        };
        village: {
            precision: number;
        };
        house: {
            precision: number;
        };
        unit: {
            precision: number;
        };
    };
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

async function fetchWorldMetadata(
    world: World,
    worldAssetMetadataCache?: CacheInterface,
): Promise<WorldAssetMetadata> {
    const cachedResult = await worldAssetMetadataCache?.get(world.url);
    if (cachedResult) {
        return cachedResult;
    }
    const metadata = await (await fetch(world.url)).json();
    if (worldAssetMetadataCache) {
        await worldAssetMetadataCache.set(world.url, metadata);
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
    const cachedResult = await worldTraversableCellsCache?.get(world.url);
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
        worldTraversableCellsCache.set(world.url, traversableCells);
    }

    return traversableCells;
}

interface SpawnItemPOI {
    prop: string;
    geohash: string;
}

interface SpawnMonsterPOI {
    beast: string;
    geohash: string;
    level: number;
}

type WorldPOIs = (SpawnItemPOI | SpawnMonsterPOI)[];

async function poisInWorld(
    world: World,
    options?: {
        worldAssetMetadataCache?: CacheInterface;
        worldPOIsCache?: CacheInterface;
    },
): Promise<WorldPOIs> {
    // Get from cache
    const cacheKey = world.url;
    const cached = await options?.worldPOIsCache?.get(cacheKey);
    if (cached) return cached;

    const pois: WorldPOIs = [];

    const asset = await fetchWorldMetadata(
        world,
        options?.worldAssetMetadataCache,
    );
    let { layers, tileheight, tilewidth } = asset;

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

                console.log(JSON.stringify(properties, null, 2));

                // Convert x, y to geohash
                const cols = Math.round(obj.x / tilewidth);
                const rows = Math.round(obj.y / tileheight);
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

                // Item poi
                if (properties.prop) {
                    pois.push({
                        prop: properties.prop,
                        geohash,
                    });
                }

                // Monster poi
                else if (properties.beast) {
                    pois.push({
                        beast: properties.beast,
                        geohash,
                        level: properties.level ?? 1,
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
