import ngeohash from "ngeohash";
import { biomes } from "./resources";

export {
    biomeAtTile,
    biomes,
    biomesAtTile,
    getCellFromTile,
    moveToTileInDirection,
    updateBiomesGrid,
    worldSeed,
    type Direction,
    type Grid,
    type WorldSeed,
};

type Direction = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "u" | "d";

// eg. grid[precision][row][col]: "forest"
type Grid = Record<number, Record<number, Record<number, string>>>;

interface WorldSeed {
    name: string;
    description: string;
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
            };
        };
    };
}

const worldSeed: WorldSeed = {
    name: "yggdrasil 01",
    description: "The beginning",
    spatial: {
        continent: {
            precision: 1, // geohash precision
        },
        territory: {
            precision: 2,
        },
        guild: {
            precision: 3,
        },
        city: {
            precision: 4,
        },
        town: {
            precision: 5,
        },
        unit: {
            precision: 8,
        },
    },
    seeds: {
        continent: {
            b: { bio: 0.5, hostile: 0.2, water: 0.1 },
            c: { bio: 0.5, hostile: 0.2, water: 0.1 },
            f: { bio: 0.5, hostile: 0.2, water: 0.1 },
            g: { bio: 0.5, hostile: 0.2, water: 0.1 },
            u: { bio: 0.5, hostile: 0.2, water: 0.1 },
            v: { bio: 0.5, hostile: 0.2, water: 0.1 },
            y: { bio: 0.5, hostile: 0.2, water: 0.1 },
            z: { bio: 0.5, hostile: 0.2, water: 0.1 },
            "8": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "9": { bio: 0.5, hostile: 0.2, water: 0.1 },
            d: { bio: 0.5, hostile: 0.2, water: 0.1 },
            e: { bio: 0.5, hostile: 0.2, water: 0.1 },
            s: { bio: 0.5, hostile: 0.2, water: 0.1 },
            t: { bio: 0.5, hostile: 0.2, water: 0.1 },
            w: { bio: 0.5, hostile: 0.2, water: 0.1 },
            x: { bio: 0.5, hostile: 0.2, water: 0.1 },
            "2": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "3": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "6": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "7": { bio: 0.5, hostile: 0.2, water: 0.1 },
            k: { bio: 0.5, hostile: 0.2, water: 0.1 },
            m: { bio: 0.5, hostile: 0.2, water: 0.1 },
            q: { bio: 0.5, hostile: 0.2, water: 0.1 },
            r: { bio: 0.5, hostile: 0.2, water: 0.1 },
            "0": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "1": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "4": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "5": { bio: 0.5, hostile: 0.2, water: 0.1 },
            h: { bio: 0.5, hostile: 0.2, water: 0.1 },
            j: { bio: 0.5, hostile: 0.2, water: 0.1 },
            n: { bio: 0.5, hostile: 0.2, water: 0.1 },
            p: { bio: 0.5, hostile: 0.2, water: 0.1 },
        },
    },
};

const gridSizeAtPrecision: Record<number, { rows: number; cols: number }> = {
    1: { rows: 4, cols: 8 },
    2: { rows: 4 * 8, cols: 8 * 4 },
    3: { rows: 4 * 8 * 4, cols: 8 * 4 * 8 },
    4: { rows: 4 * 8 * 4 * 8, cols: 8 * 4 * 8 * 4 },
    5: { rows: 4 * 8 * 4 * 8 * 4, cols: 8 * 4 * 8 * 4 * 8 },
    6: { rows: 4 * 8 * 4 * 8 * 4 * 8, cols: 8 * 4 * 8 * 4 * 8 * 4 },
    7: { rows: 4 * 8 * 4 * 8 * 4 * 8 * 4, cols: 8 * 4 * 8 * 4 * 8 * 4 * 8 },
    8: {
        rows: 4 * 8 * 4 * 8 * 4 * 8 * 4 * 8,
        cols: 8 * 4 * 8 * 4 * 8 * 4 * 8 * 4,
    },
    9: {
        rows: 4 * 8 * 4 * 8 * 4 * 8 * 4 * 8 * 4,
        cols: 8 * 4 * 8 * 4 * 8 * 4 * 8 * 4 * 8,
    },
};

function stringToRandomNumber(str: string): number {
    var hash = 0;
    if (str.length === 0) return hash;
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char; // Bitwise left shift and subtraction
        hash &= hash; // Convert to 32bit integer
    }
    return Math.abs(hash); // Ensure positive number
}

function seededRandom(seed: number): number {
    var x = Math.sin(seed) * 10000; // how many decimal places
    return x - Math.floor(x);
}

function biomeAtTile(tile: string, seed?: WorldSeed): string {
    seed = seed || worldSeed;
    const continent = tile.charAt(0);
    const probBio = seed.seeds.continent[continent].bio;
    const probWater = seed.seeds.continent[continent].water;
    const totalProb = probBio + probWater;

    // Use the tile as the random seed (must be reproducible)
    const rv = seededRandom(stringToRandomNumber(tile)) * totalProb;

    // Select biome
    if (rv < probBio) {
        return biomes.forest.name;
    }
    if (rv < probBio + probWater) {
        return biomes.water.name;
    }
    return biomes.plains.name;
}

function biomesAtTile(tile: string, seed?: WorldSeed): Record<string, string> {
    seed = seed || worldSeed;

    const [minlat, minlon, maxlat, maxlon] = ngeohash.decode_bbox(tile);
    // Get all the geohashes 1 precision level above the tile
    const geohashes = ngeohash.bboxes(
        minlat,
        minlon,
        maxlat,
        maxlon,
        tile.length + 1,
    );

    return geohashes.reduce((obj: any, tile) => {
        obj[tile] = biomeAtTile(tile, seed);
        return obj;
    }, {});
}

function updateBiomesGrid(grid: Grid, biomes: Record<string, string>) {
    for (const [tile, biome] of Object.entries(biomes)) {
        const precision = tile.length;
        // latitude (-90 at south, 90 at north) and longitude (-180 at west, 180 at east)
        const { latitude, longitude } = ngeohash.decode(tile);
        // -latitude because we want top left to be (0, 0)
        const row = Math.floor(
            ((-latitude + 90) / 180) * gridSizeAtPrecision[precision].rows,
        );
        const col = Math.floor(
            ((longitude + 180) / 360) * gridSizeAtPrecision[precision].cols,
        );

        // Initialize grid cell if not present
        if (!grid[precision]) {
            grid[precision] = {};
        }
        if (!grid[precision][row]) {
            grid[precision][row] = {};
        }

        grid[precision][row][col] = biome;
    }
    return grid;
}

function getCellFromTile(tile: string): {
    precision: number;
    row: number;
    col: number;
} {
    const precision = tile.length;
    const { latitude, longitude } = ngeohash.decode(tile);

    // -latitude because we want top left to be (0, 0)
    const row = Math.floor(
        ((-latitude + 90) / 180) * gridSizeAtPrecision[precision].rows,
    );
    const col = Math.floor(
        ((longitude + 180) / 360) * gridSizeAtPrecision[precision].cols,
    );

    return { precision, row, col };
}

function moveToTileInDirection(tile: string, direction: Direction): string {
    if (direction === "n") {
        return ngeohash.neighbor(tile, [1, 0]);
    } else if (direction === "s") {
        return ngeohash.neighbor(tile, [-1, 0]);
    } else if (direction === "e") {
        return ngeohash.neighbor(tile, [0, 1]);
    } else if (direction === "w") {
        return ngeohash.neighbor(tile, [0, -1]);
    } else if (direction === "ne") {
        return ngeohash.neighbor(tile, [1, 1]);
    } else if (direction === "nw") {
        return ngeohash.neighbor(tile, [1, -1]);
    } else if (direction === "se") {
        return ngeohash.neighbor(tile, [-1, 1]);
    } else if (direction === "sw") {
        return ngeohash.neighbor(tile, [-1, -1]);
    }
    return tile;
}
