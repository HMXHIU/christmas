import type { CacheInterface } from "$lib/caches";
import { seededRandom, stringToRandomNumber } from "$lib/utils";
import { uniqBy } from "lodash-es";
import {
    autoCorrectGeohashPrecision,
    evenGeohashCharacters,
    geohashDistance,
    geohashToColRow,
    gridCellToGeohash,
    oddGeohashCharacters,
} from "../utils";
import type { BiomeType } from "./biomes";
import { dungeons, type Dungeon } from "./settings/dungeons";
import { worldSeed } from "./settings/world";
import { geohashLocationTypes, type GeohashLocation } from "./types";

export { dungeonBiomeAtGeohash, generateDungeonGraph, getAllDungeons };

interface Room {
    geohash: string; // town
    connections: string[]; // connected room geohashes
    entrances: string[]; // to connect above to below ground
}

interface DungeonGraph {
    rooms: Room[];
    territory: string;
    locationType: GeohashLocation;
    corridors: Set<string>; // set of all corridor geohashes
    corridorPrecision: number; // precision of corridor geohashes
}

const MIN_ROOMS = 12;
const MAX_ROOMS = 18;
const MIN_ENTRANCES = 1;
const MAX_ENTRANCES = 3;

async function dungeonBiomeAtGeohash(
    geohash: string,
    locationType: GeohashLocation,
    options?: {
        dungeonGraphCache?: CacheInterface;
        dungeons?: Dungeon[]; // for manually specifying dungeon locations
    },
): Promise<[BiomeType, number]> {
    if (!geohashLocationTypes.has(locationType)) {
        throw new Error("Location is not GeohashLocation");
    }
    if (locationType === "geohash") {
        throw new Error("Location is not underground");
    }
    const territory = geohash.slice(0, 2);
    let dungeon = (options?.dungeons ?? dungeons).find((d) =>
        d.dungeon.startsWith(territory),
    );

    let graph = await generateDungeonGraph(territory, locationType, {
        dungeonGraphCache: options?.dungeonGraphCache,
        dungeon,
    });

    // geohash is in a room/chamber
    if (graph.rooms.some((r) => geohash.startsWith(r.geohash))) {
        return ["grassland", 1];
    }

    // Check if geohash is in a corridor
    if (inCorridor(geohash, graph)) {
        return ["grassland", 1];
    }

    // If not in a room or corridor, it's a wall
    return ["underground", 1];
}

async function generateDungeonGraph(
    territory: string,
    locationType: GeohashLocation,
    options?: {
        dungeon?: Dungeon;
        dungeonGraphCache?: CacheInterface;
    },
): Promise<DungeonGraph> {
    // Get from cache
    const cacheKey = `${territory}-${locationType}`;
    let graph = await options?.dungeonGraphCache?.get(cacheKey);
    if (graph) return graph;

    const rv = seededRandom(stringToRandomNumber(territory + locationType));

    // Dungeon location is city precision
    const dungeon = options?.dungeon;
    const city = dungeon
        ? dungeon.dungeon
        : autoCorrectGeohashPrecision(
              territory,
              worldSeed.spatial.city.precision,
              rv,
          );

    let rooms: Room[] = [];

    // Generate rooms (town precision) - manually defined
    if (dungeon) {
        for (const { room, entrances } of dungeon.rooms) {
            const town = autoCorrectGeohashPrecision(
                room,
                worldSeed.spatial.town.precision,
            );
            rooms.push({ geohash: town, connections: [], entrances });
        }
    }

    // Generate rooms (town precision) - randomly
    const numRooms = Math.floor(rv * (MAX_ROOMS - MIN_ROOMS + 1)) + MIN_ROOMS;
    const numEntrances =
        Math.floor(rv * (MAX_ENTRANCES - MIN_ENTRANCES + 1)) + MIN_ENTRANCES;
    let entranceCount = 0;
    for (let i = 0; i < numRooms; i++) {
        const roomRv = seededRandom(
            stringToRandomNumber(territory + locationType) + i,
        );
        const town = autoCorrectGeohashPrecision(
            city,
            worldSeed.spatial.town.precision,
            roomRv,
        );

        // Generate entrance
        const entrances: string[] = [];
        if (entranceCount < numEntrances) {
            entrances.push(
                autoCorrectGeohashPrecision(
                    town,
                    worldSeed.spatial.unit.precision,
                    roomRv,
                ),
            );
            entranceCount += 1;
        }

        rooms.push({ geohash: town, connections: [], entrances });
    }
    rooms = uniqBy(rooms, (r) => r.geohash);

    // Connect rooms and generate corridors
    const corridors = new Set<string>();
    const corridorPrecision = worldSeed.spatial.house.precision; // corridor should be thinner than the room (town)
    const connectedRooms = new Set<string>();
    let currentRoom = rooms[Math.floor(rv * rooms.length)];
    connectedRooms.add(currentRoom.geohash);

    while (connectedRooms.size < rooms.length) {
        const unconnectedRooms = rooms.filter(
            (r) => !connectedRooms.has(r.geohash),
        );
        unconnectedRooms.sort(
            (a, b) =>
                geohashDistance(currentRoom.geohash, a.geohash) -
                geohashDistance(currentRoom.geohash, b.geohash),
        );

        const numConnections = Math.min(
            1 + Math.floor(rv * 2),
            unconnectedRooms.length,
        );
        for (let i = 0; i < numConnections; i++) {
            const nextRoom = unconnectedRooms[i];
            generateCorridor(
                currentRoom.geohash,
                nextRoom.geohash,
                corridorPrecision,
            ).forEach((c) => corridors.add(c));
            currentRoom.connections.push(nextRoom.geohash);
            nextRoom.connections.push(currentRoom.geohash);
            connectedRooms.add(nextRoom.geohash);
        }

        currentRoom = unconnectedRooms[0];
    }

    graph = { rooms, corridors, corridorPrecision, locationType, territory };

    // Set cache
    if (options?.dungeonGraphCache) {
        options.dungeonGraphCache.set(cacheKey, graph);
    }

    return graph;
}

function inCorridor(geohash: string, graph: DungeonGraph): boolean {
    const corridorGeohash = geohash.slice(0, graph.corridorPrecision);
    return graph.corridors.has(corridorGeohash);
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
    options?: { dungeons?: Dungeon[] },
): Promise<Record<string, DungeonGraph>> {
    const dungeonGraphs: Record<string, DungeonGraph> = {};
    for (const a of oddGeohashCharacters) {
        for (const b of evenGeohashCharacters) {
            const territory = a + b;
            let dungeon = (options?.dungeons ?? dungeons).find((d) =>
                d.dungeon.startsWith(territory),
            );
            dungeonGraphs[territory] = await generateDungeonGraph(
                territory,
                locationType,
                { dungeon },
            );
        }
    }

    return dungeonGraphs;
}
