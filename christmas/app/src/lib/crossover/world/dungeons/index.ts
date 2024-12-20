import type { CacheInterface } from "$lib/caches";
import { seededRandom, stringToRandomNumber } from "$lib/utils/random";
import {
    autoCorrectGeohashPrecision,
    geohashDistance,
    geohashToColRow,
    gridCellToGeohash,
} from "../../utils";
import { elevationAtGeohash, type BiomeType } from "../biomes";
import { prefabDungeons } from "../settings/dungeons";
import {
    fetchSanctuaries,
    topologicalAnalysis,
    worldSeed,
} from "../settings/world";
import { geohashLocationTypes, type GeohashLocation } from "../types";
import { generateRoomsBSP } from "./bsp";
import type { DungeonGraph, Room } from "./types";

export {
    DUNGEON_PRECISION,
    dungeonBiomeAtGeohash,
    generateDungeonGraph,
    generateDungeonGraphsForTerritory,
};

const MIN_ROOMS = 12;
const MAX_ROOMS = 18;
const ROOM_UNIT_PRECISION = worldSeed.spatial.house.precision;
const DUNGEON_PRECISION = worldSeed.spatial.town.precision;

async function dungeonBiomeAtGeohash(
    geohash: string,
    locationType: GeohashLocation,
    options?: {
        dungeonGraphCache?: CacheInterface;
        dungeonsAtTerritoryCache?: CacheInterface;
        topologyResponseCache?: CacheInterface;
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
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
            dungeonsAtTerritoryCache: options?.dungeonsAtTerritoryCache,
            topologyResponseCache: options?.topologyResponseCache,
            topologyResultCache: options?.topologyResultCache,
            topologyBufferCache: options?.topologyBufferCache,
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

/**
 * Every sanctuary has 1 dungeon
 * Every territory (on land) has 1 dungeon
 * Additionally prefab dungeons are also spawned if specified
 */
async function generateDungeonGraphsForTerritory(
    territory: string,
    locationType: GeohashLocation,
    options?: {
        dungeonGraphCache?: CacheInterface;
        dungeonsAtTerritoryCache?: CacheInterface;
        topologyResponseCache?: CacheInterface;
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
    },
): Promise<Record<string, DungeonGraph>> {
    // Get from cache
    const cacheKey = territory;
    let graphs: Record<string, DungeonGraph> =
        await options?.dungeonsAtTerritoryCache?.get(cacheKey);
    if (graphs) return graphs;
    graphs = {};

    // Generate dungeons at every sanctuary
    for (const s of await fetchSanctuaries()) {
        if (s.geohash.startsWith(territory)) {
            let dungeon = s.geohash.slice(0, DUNGEON_PRECISION);
            graphs[dungeon] = await generateDungeonGraph(
                dungeon,
                locationType,
                {
                    dungeonGraphCache: options?.dungeonGraphCache,
                },
            );
        }
    }

    // Generate dungeons at prefab
    for (const [dungeon, _] of Object.entries(prefabDungeons)) {
        // Check no overlap between sanctuary dungeons
        const hasOverlap = Object.keys(graphs).find((d) =>
            dungeon.startsWith(d),
        );
        if (dungeon.startsWith(territory) && !hasOverlap) {
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
    const ta = (await topologicalAnalysis())[territory];

    // Exclude territories with little land
    if (ta && ta.land >= 0.2) {
        const seed = stringToRandomNumber(territory + locationType);
        const rv = seededRandom(seed);
        let dungeon = autoCorrectGeohashPrecision(
            territory,
            DUNGEON_PRECISION,
            rv,
        );

        // Exclude dungeons underwater (Note: dungeons are underground but accessible from above ground)
        const elevation = await elevationAtGeohash(dungeon, "geohash", {
            responseCache: options?.topologyResponseCache,
            resultsCache: options?.topologyResultCache,
            bufferCache: options?.topologyBufferCache,
        });

        if (elevation > 0) {
            // Check no overlap between prefab & sanctuary dungeons
            const hasOverlap = Object.keys(graphs).find((d) =>
                dungeon.startsWith(d),
            );
            if (!hasOverlap) {
                graphs[dungeon] = await generateDungeonGraph(
                    dungeon,
                    locationType,
                    {
                        dungeonGraphCache: options?.dungeonGraphCache,
                    },
                );
            }
        }
    }

    // Set cache
    if (options?.dungeonsAtTerritoryCache) {
        options.dungeonsAtTerritoryCache.set(cacheKey, graphs);
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

    // Determine number of rooms
    const numRooms = Math.floor(rv * (MAX_ROOMS - MIN_ROOMS + 1)) + MIN_ROOMS;

    // Generate rooms
    let rooms: Room[] = generateRoomsBSP({
        geohash: dungeon,
        unitPrecision: ROOM_UNIT_PRECISION,
        minDepth: 7,
        maxDepth: 10,
        numRooms,
    });

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
            generateCorridor(currentRoom, nextRoom, corridorPrecision).forEach(
                (c) => corridors.add(c),
            );
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
    startRoom: Room,
    endRoom: Room,
    precision: number,
): string[] {
    const start = autoCorrectGeohashPrecision(startRoom.room, precision);
    const end = autoCorrectGeohashPrecision(endRoom.room, precision);

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
        const plot = gridCellToGeohash({
            col: currentX,
            row: currentY,
            precision,
        });

        // Exclude plot if it is in startRoom or endRoom
        if (
            !(
                (precision >= startRoom.plotPrecision &&
                    startRoom.plots.has(
                        plot.slice(0, startRoom.plotPrecision),
                    )) ||
                (precision >= endRoom.plotPrecision &&
                    endRoom.plots.has(plot.slice(0, endRoom.plotPrecision)))
            )
        ) {
            points.push(plot);
        }
    }

    return points;
}
