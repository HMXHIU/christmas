import type { CacheInterface } from "$lib/caches";
import { uniqBy } from "lodash-es";
import {
    autoCorrectGeohashPrecision,
    evenGeohashCharacters,
    geohashDistance,
    geohashToColRow,
    gridCellToGeohash,
    oddGeohashCharacters,
    seededRandom,
    stringToRandomNumber,
} from "../utils";
import type { BiomeType } from "./biomes";
import { worldSeed } from "./settings/world";
import { geohashLocationTypes, type GeohashLocationType } from "./types";

export { dungeonBiomeAtGeohash, generateDungeonGraph, getAllDungeons };

interface Room {
    geohash: string; // town
    connections: string[]; // Connected room geohashes
}

interface DungeonGraph {
    rooms: Room[];
    territory: string;
    locationType: GeohashLocationType;
    corridors: Set<string>; // Set of all corridor geohashes
    corridorPrecision: number; // Precision of corridor geohashes
}

const MIN_ROOMS = 12;
const MAX_ROOMS = 18;

async function dungeonBiomeAtGeohash(
    geohash: string,
    locationType: GeohashLocationType,
    options?: {
        dungeonGraphCache?: CacheInterface;
    },
): Promise<[BiomeType, number]> {
    if (!geohashLocationTypes.has(locationType)) {
        throw new Error("Location is not GeohashLocationType");
    }
    if (locationType === "geohash") {
        throw new Error("Location is not underground");
    }

    const territory = geohash.slice(0, 2);
    let graph = await generateDungeonGraph(
        territory,
        locationType,
        options?.dungeonGraphCache,
    );

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
    locationType: GeohashLocationType,
    dungeonGraphCache?: CacheInterface,
): Promise<DungeonGraph> {
    // Get from cache
    const cacheKey = `${territory}-${locationType}`;
    let graph = await dungeonGraphCache?.get(cacheKey);
    if (graph) return graph;

    const rv = seededRandom(stringToRandomNumber(territory + locationType));

    // Dungeon location is city precision
    const city = autoCorrectGeohashPrecision(
        territory,
        worldSeed.spatial.city.precision,
        rv,
    );

    // Generate rooms (town precision)
    const numRooms = Math.floor(rv * (MAX_ROOMS - MIN_ROOMS + 1)) + MIN_ROOMS;
    let rooms: Room[] = [];
    for (let i = 0; i < numRooms; i++) {
        const roomRv = seededRandom(
            stringToRandomNumber(territory + locationType) + i,
        );
        const town = autoCorrectGeohashPrecision(
            city,
            worldSeed.spatial.town.precision,
            roomRv,
        );
        rooms.push({ geohash: town, connections: [] });
    }
    rooms = uniqBy(rooms, (r) => r.geohash); // remove repeated

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
            generateLine(
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
    if (dungeonGraphCache) {
        dungeonGraphCache.set(cacheKey, graph);
    }

    return graph;
}

function inCorridor(geohash: string, graph: DungeonGraph): boolean {
    const corridorGeohash = geohash.slice(0, graph.corridorPrecision);
    return graph.corridors.has(corridorGeohash);
}

function generateLine(start: string, end: string, precision: number): string[] {
    start = autoCorrectGeohashPrecision(start, precision);
    end = autoCorrectGeohashPrecision(end, precision);

    const [x1, y1] = geohashToColRow(start);
    const [x2, y2] = geohashToColRow(end);
    const points: string[] = [];
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));

    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = Math.round(x1 + t * (x2 - x1));
        const y = Math.round(y1 + t * (y2 - y1));
        points.push(gridCellToGeohash({ col: x, row: y, precision }));
    }

    return points;
}

async function getAllDungeons(
    locationType: GeohashLocationType,
): Promise<Record<string, DungeonGraph>> {
    const dungeons: Record<string, DungeonGraph> = {};
    for (const a of oddGeohashCharacters) {
        for (const b of evenGeohashCharacters) {
            const territory = a + b;
            dungeons[territory] = await generateDungeonGraph(
                territory,
                locationType,
            );
        }
    }

    return dungeons;
}
