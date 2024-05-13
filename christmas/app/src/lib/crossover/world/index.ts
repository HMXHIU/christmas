import ngeohash from "ngeohash";
import { type Tile } from "./biomes";
import { type EquipmentSlot } from "./compendium";

export {
    Directions,
    abyssTile,
    geohashToGridCell,
    gridCellToGeohash,
    type AssetMetadata,
    type Direction,
    type EntityType,
    type GridCell,
    type LocationType,
    type WorldAssetMetadata,
    type WorldSeed,
};

const abyssTile: Tile = {
    name: "The Abyss",
    geohash: "59ke577h",
    description: "You are nowhere to be found.",
};

interface AssetMetadata {
    bundle: string;
    name: string;
    animations?: Record<string, string>; // create an animation pointing to an in the sprite.json
    variants?: Record<string, string>; // create a variant pointing to a frame in the sprite.json
    prob?: Record<string, number>; // probability of each variant
    width: number; // number of horizontal cells at the geohash precision (origin is always top left)
    height: number; // number of vertical cells at the geohash precision (origin is always top left)
    precision: number; // geohash precision
}

interface WorldAssetMetadata {
    layers: {
        data: number[];
        properties?: { name: string; value: any; type: string }[];
        offsetx?: number; // offset in pixels
        offsety?: number;
        height: number; // height in tiles
        width: number;
        name: string;
        type: "tilelayer";
        x: number; // x coordinate in tiles
        y: number;
    }[];
    height: number;
    width: number;
    tilewidth: number;
    tileheight: number;
}

type Direction = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "u" | "d";
const Directions: Direction[] = [
    "n",
    "s",
    "e",
    "w",
    "ne",
    "nw",
    "se",
    "sw",
    "u",
    "d",
];

type EntityType = "player" | "monster" | "item";

type LocationType =
    | "geohash"
    | "item"
    | "inv" // inventory
    | EquipmentSlot;

type GridCell = {
    precision: number;
    row: number;
    col: number;
};

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

/**
 * Gets the grid cell coordinates for a given geohash.
 *
 * @param geohash - The geohash string.
 * @returns An object with the precision, row and column for the geohash in the grid.
 */
function geohashToGridCell(geohash: string): GridCell {
    const precision = geohash.length;
    const { latitude, longitude } = ngeohash.decode(geohash);

    // -latitude because we want top left to be (0, 0)
    const row = Math.floor(
        ((-latitude + 90) / 180) * gridSizeAtPrecision[precision].rows,
    );
    const col = Math.floor(
        ((longitude + 180) / 360) * gridSizeAtPrecision[precision].cols,
    );

    return { precision, row, col };
}

/**
 * Converts a grid cell to a geohash string.
 *
 * @param precision - The precision level of the geohash.
 * @param row - The row index of the grid cell.
 * @param col - The column index of the grid cell.
 * @returns The geohash string representing the grid cell.
 */
function gridCellToGeohash({ precision, row, col }: GridCell): string {
    const lat = -(
        ((row + 0.5) / gridSizeAtPrecision[precision].rows) * 180 -
        90
    );
    const lon = ((col + 0.5) / gridSizeAtPrecision[precision].cols) * 360 - 180;
    return ngeohash.encode(lat, lon, precision);
}
