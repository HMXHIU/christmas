import type { CacheInterface } from "$lib/caches";
import type { World } from "$lib/server/crossover/redis/entities";
import { autoCorrectGeohashPrecision, geohashToColRow } from "../utils";
import { TILE_HEIGHT, TILE_WIDTH } from "./settings";
import sanctuaries from "./settings/sanctuaries.json";
import { worldSeed } from "./settings/world";
import type { WorldAssetMetadata } from "./types";

export {
    sanctuaries,
    sanctuariesByRegion,
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
        guild: {
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
                bio: number;
                hostile: number;
                water: number;
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

const sanctuariesByRegion = sanctuaries.reduce(
    (acc: Record<string, Sanctuary>, s) => {
        acc[s.region] = s;
        return acc;
    },
    {},
);

async function fetchWorldMetadata(
    world: World,
    metadataCache?: CacheInterface,
): Promise<WorldAssetMetadata> {
    const cachedResult = await metadataCache?.get(world.url);
    if (cachedResult) {
        return cachedResult;
    }
    const metadata = await (await fetch(world.url)).json();
    if (metadataCache) {
        await metadataCache.set(world.url, metadata);
    }
    return metadata;
}

async function traversableSpeedInWorld({
    world,
    geohash,
    tileHeight,
    tileWidth,
    metadataCache,
    resultsCache,
}: {
    world: World;
    geohash: string;
    tileHeight?: number;
    tileWidth?: number;
    metadataCache?: CacheInterface;
    resultsCache?: CacheInterface;
}): Promise<number | undefined> {
    const traversableCells = await traversableCellsInWorld({
        world,
        tileHeight: tileHeight ?? TILE_HEIGHT,
        tileWidth: tileWidth ?? TILE_WIDTH,
        metadataCache,
        resultsCache,
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
    metadataCache,
    resultsCache,
}: {
    world: World;
    tileWidth: number;
    tileHeight: number;
    metadataCache?: CacheInterface;
    resultsCache?: CacheInterface;
}): Promise<Record<string, number>> {
    const cachedResult = await resultsCache?.get(world.url);
    if (cachedResult) {
        return cachedResult;
    }
    const asset = await fetchWorldMetadata(world, metadataCache);
    const { layers, tileheight, tilewidth } = asset;
    const heightMultiplier = tileheight / tileHeight;
    const widthMultiplier = tilewidth / tileWidth;

    let traversableCells: Record<string, number> = {};
    for (const { data, properties, width, height } of layers) {
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

    if (resultsCache) {
        resultsCache.set(world.url, traversableCells);
    }

    return traversableCells;
}
