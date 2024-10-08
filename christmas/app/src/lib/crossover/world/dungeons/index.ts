import type { CacheInterface } from "$lib/caches";
import { sampleFrom, seededRandom, stringToRandomNumber } from "$lib/utils";
import {
    autoCorrectGeohashPrecision,
    evenGeohashCharacters,
    geohashDistance,
    geohashToColRow,
    gridCellToGeohash,
    oddGeohashCharacters,
} from "../../utils";
import type { BiomeType } from "../biomes";
import { prefabDungeons } from "../settings/dungeons";
import { worldSeed } from "../settings/world";
import { geohashLocationTypes, type GeohashLocation } from "../types";
import { generateRoomsBSP } from "./bsp";
import type { DungeonGraph, Room } from "./types";

export {
    dungeonBiomeAtGeohash,
    generateDungeonGraph,
    generateDungeonGraphsForTerritory,
    getAllDungeons,
};

const MIN_ROOMS = 12;
const MAX_ROOMS = 18;
const MIN_ENTRANCES = 1;
const MAX_ENTRANCES = 3;

const ROOM_UNIT_PRECISION = worldSeed.spatial.house.precision;
const DUNGEON_PRECISION = worldSeed.spatial.town.precision;

async function dungeonBiomeAtGeohash(
    geohash: string,
    locationType: GeohashLocation,
    options?: {
        dungeonGraphCache?: CacheInterface;
    },
): Promise<[BiomeType, number]> {
    if (!geohashLocationTypes.has(locationType)) {
        throw new Error("Location is not GeohashLocation");
    }
    if (locationType === "geohash") {
        throw new Error("Location is not underground");
    }

    // Get the dungeon graphs for the territory
    const territory = geohash.slice(0, 2);
    let graphs = await generateDungeonGraphsForTerritory(
        territory,
        locationType,
        {
            dungeonGraphCache: options?.dungeonGraphCache,
        },
    );

    for (const graph of Object.values(graphs)) {
        // In room
        if (
            graph.rooms.some((r) =>
                r.plots.has(geohash.slice(0, r.plotPrecision)),
            )
        ) {
            return ["grassland", 1];
        }
        // In corridor
        if (graph.corridors.has(geohash.slice(0, graph.corridorPrecision))) {
            return ["grassland", 1];
        }
    }

    // If not in a room or corridor, it's a wall
    return ["underground", 1];
}

async function generateDungeonGraphsForTerritory(
    territory: string,
    locationType: GeohashLocation,
    options?: {
        dungeonGraphCache?: CacheInterface;
    },
): Promise<Record<string, DungeonGraph>> {
    const graphs: Record<string, DungeonGraph> = {};
    // Generate prefabricated dungeons
    for (const [dungeon, _] of Object.entries(prefabDungeons)) {
        if (dungeon.startsWith(territory)) {
            graphs[dungeon] = await generateDungeonGraph(
                dungeon,
                locationType,
                {
                    dungeonGraphCache: options?.dungeonGraphCache,
                },
            );
        }
    }

    // Procedurally generate dungeon at territory
    const seed = stringToRandomNumber(territory + locationType);
    const rv = seededRandom(seed);
    let dungeon = autoCorrectGeohashPrecision(territory, DUNGEON_PRECISION, rv);

    // Check no overlap between prefab dungeons
    const hasOverlap = Object.keys(graphs).find((d) => dungeon.startsWith(d));
    if (!hasOverlap) {
        graphs[dungeon] = await generateDungeonGraph(dungeon, locationType, {
            dungeonGraphCache: options?.dungeonGraphCache,
        });
    }

    return graphs;
}

async function generateDungeonGraph(
    dungeon: string,
    locationType: GeohashLocation,
    options?: {
        dungeonGraphCache?: CacheInterface;
    },
): Promise<DungeonGraph> {
    // Get from cache
    const cacheKey = `${dungeon}-${locationType}`;
    let graph: DungeonGraph = await options?.dungeonGraphCache?.get(cacheKey);
    if (graph) return graph;

    const seed = stringToRandomNumber(dungeon + locationType);
    const rv = seededRandom(seed);

    // Determine number of rooms and entrances
    const numRooms = Math.floor(rv * (MAX_ROOMS - MIN_ROOMS + 1)) + MIN_ROOMS;
    const numEntrances =
        Math.floor(rv * (MAX_ENTRANCES - MIN_ENTRANCES + 1)) + MIN_ENTRANCES;

    // Generate rooms
    let rooms: Room[] = generateRoomsBSP({
        geohash: dungeon,
        unitPrecision: ROOM_UNIT_PRECISION,
        minDepth: 7,
        maxDepth: 10,
        numRooms,
    });

    // Generate room entrances
    const roomsWithEntrances = sampleFrom(rooms, numEntrances, seed);
    for (const r of roomsWithEntrances) {
        const plotWithEntrance = sampleFrom(
            Array.from(r.plots).sort(),
            1,
            seed,
        )[0];
        r.entrances.push(
            autoCorrectGeohashPrecision(
                plotWithEntrance,
                worldSeed.spatial.unit.precision,
                seededRandom(stringToRandomNumber(plotWithEntrance)),
            ),
        );
    }

    // Connect rooms with corridors
    const corridors = new Set<string>();
    const corridorPrecision = worldSeed.spatial.house.precision;
    const connectedRooms = new Set<string>();
    let currentRoom = rooms[Math.floor(rv * rooms.length)];
    connectedRooms.add(currentRoom.room);

    while (connectedRooms.size < rooms.length) {
        const unconnectedRooms = rooms.filter(
            (r) => !connectedRooms.has(r.room),
        );
        unconnectedRooms.sort(
            (a, b) =>
                geohashDistance(currentRoom.room, a.room) -
                geohashDistance(currentRoom.room, b.room),
        );
        const numConnections = Math.min(
            1 + Math.floor(rv * 2),
            unconnectedRooms.length,
        );
        for (let i = 0; i < numConnections; i++) {
            const nextRoom = unconnectedRooms[i];
            generateCorridor(
                currentRoom.room,
                nextRoom.room,
                corridorPrecision,
            ).forEach((c) => corridors.add(c));
            currentRoom.connections.push(nextRoom.room);
            nextRoom.connections.push(currentRoom.room);
            connectedRooms.add(nextRoom.room);
        }

        currentRoom = unconnectedRooms[0];
    }

    graph = {
        dungeon,
        rooms,
        corridors,
        corridorPrecision,
        locationType,
    };

    // Set cache
    if (options?.dungeonGraphCache) {
        options.dungeonGraphCache.set(cacheKey, graph);
    }

    return graph;
}

function generateCorridor(
    start: string,
    end: string,
    precision: number,
): string[] {
    start = autoCorrectGeohashPrecision(start, precision);
    end = autoCorrectGeohashPrecision(end, precision);

    const [x1, y1] = geohashToColRow(start);
    const [x2, y2] = geohashToColRow(end);
    const points: string[] = [];

    let currentX = x1;
    let currentY = y1;

    // Determine the overall direction
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Randomly decide whether to move horizontally or vertically first
    const moveHorizontalFirst =
        seededRandom(stringToRandomNumber(start + end)) < 0.5;

    while (currentX !== x2 || currentY !== y2) {
        if (moveHorizontalFirst) {
            // Move horizontally first
            if (currentX !== x2) {
                currentX += dx > 0 ? 1 : -1;
            } else if (currentY !== y2) {
                currentY += dy > 0 ? 1 : -1;
            }
        } else {
            // Move vertically first
            if (currentY !== y2) {
                currentY += dy > 0 ? 1 : -1;
            } else if (currentX !== x2) {
                currentX += dx > 0 ? 1 : -1;
            }
        }
        points.push(
            gridCellToGeohash({ col: currentX, row: currentY, precision }),
        );
    }

    return points;
}

async function getAllDungeons(
    locationType: GeohashLocation,
    options?: {
        dungeonGraphCache?: CacheInterface;
    },
): Promise<Record<string, DungeonGraph>> {
    const dungeonGraphs: Record<string, DungeonGraph> = {};
    for (const a of oddGeohashCharacters) {
        for (const b of evenGeohashCharacters) {
            const territory = a + b;
            const graphs = await generateDungeonGraphsForTerritory(
                territory,
                locationType,
                { dungeonGraphCache: options?.dungeonGraphCache },
            );
            Object.assign(dungeonGraphs, graphs);
        }
    }
    return dungeonGraphs;
}
