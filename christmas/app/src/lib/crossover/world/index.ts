import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import lodash from "lodash";
import ngeohash from "ngeohash";
import { type Tile } from "./biomes";
import { type EquipmentSlot } from "./compendium";
const { groupBy } = lodash;

export {
    Directions,
    abyssTile,
    geohashToGridCell,
    gridCellToGeohash,
    updateGrid,
    updateGridEntry,
    type AssetMetadata,
    type Direction,
    type Grid,
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

type LocationType =
    | "geohash"
    | "item"
    | "inv" // inventory
    | EquipmentSlot;

interface GridEntry {
    monsters?: Record<string, Monster>;
    players?: Record<string, Player>;
    items?: Record<string, Item>;
}
// grid[precision][row][col][GridEntry]
type Grid = Record<number, Record<number, Record<number, GridEntry>>>;

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
 * Updates (recreate at geohash) or Upserts the provided grid with entities.
 *
 * @param grid - The grid to update.
 * @param upsert - Whether to upsert the provided monsters, players, and items (default: false).
 * @param monsters - Array of monsters to add to the grid.
 * @param players - Array of players to add to the grid.
 * @param items - Array of items to add to the grid.
 * @returns The updated grid.
 */
function updateGrid({
    grid,
    monsters,
    players,
    items,
    upsert = false,
}: {
    grid: Grid;
    monsters?: Monster[];
    players?: Player[];
    items?: Item[];
    upsert?: boolean;
}) {
    // Delete monsters, players, items from grid (relocated)
    const monsterIds = monsters?.map((mx) => mx.monster) || [];
    const playerIds = players?.map((px) => px.player) || [];
    const itemIds = items?.map((ix) => ix.item) || [];
    for (const xxs of Object.values(grid)) {
        for (const xs of Object.values(xxs)) {
            for (const entry of Object.values(xs)) {
                if (entry.monsters) {
                    for (const monsterId of Object.keys(entry.monsters)) {
                        if (monsterIds.includes(monsterId)) {
                            delete entry.monsters[monsterId];
                        }
                    }
                }
                if (entry.players) {
                    for (const playerId of Object.keys(entry.players)) {
                        if (playerIds.includes(playerId)) {
                            delete entry.players[playerId];
                        }
                    }
                }
                if (entry.items) {
                    for (const itemId of Object.keys(entry.items)) {
                        if (itemIds.includes(itemId)) {
                            delete entry.items[itemId];
                        }
                    }
                }
            }
        }
    }

    // Recreate monsters at geohash (TODO: account for monsters with > 1 cell)
    if (monsters && monsters.length > 0) {
        for (const [geohash, mxs] of Object.entries(
            groupBy(monsters, (monster) => monster.location[0]),
        )) {
            const { precision, row, col } = geohashToGridCell(geohash);
            const providedMonsters = mxs.reduce(
                (acc, mx) => {
                    acc[mx.monster] = mx;
                    return acc;
                },
                {} as Record<string, Monster>,
            );
            const existingMonsters =
                grid?.[precision]?.[row]?.[col]?.monsters || {};

            updateGridEntry({
                grid,
                precision,
                row,
                col,
                monsters: upsert
                    ? { ...existingMonsters, ...providedMonsters }
                    : providedMonsters,
            });
        }
    }

    // Recreate players at geohash
    if (players && players.length > 0) {
        for (const [geohash, pxs] of Object.entries(
            groupBy(players, (player) => player.location[0]),
        )) {
            const { precision, row, col } = geohashToGridCell(geohash);
            const providedPlayers = pxs.reduce(
                (acc, px) => {
                    acc[px.player] = px;
                    return acc;
                },
                {} as Record<string, Player>,
            );
            const existingPlayers =
                grid?.[precision]?.[row]?.[col]?.players || {};
            updateGridEntry({
                grid,
                precision,
                row,
                col,
                players: upsert
                    ? { ...existingPlayers, ...providedPlayers }
                    : providedPlayers,
            });
        }
    }

    // Recreate items at geohash (TODO: account for monsters with > 1 cell)
    if (items && items.length > 0) {
        for (const [geohash, ixs] of Object.entries(
            groupBy(items, (item) => item.location[0]),
        )) {
            const { precision, row, col } = geohashToGridCell(geohash);
            const providedItems = ixs.reduce(
                (acc, ix) => {
                    acc[ix.item] = ix;
                    return acc;
                },
                {} as Record<string, Item>,
            );
            const existingItems = grid?.[precision]?.[row]?.[col]?.items || {};
            updateGridEntry({
                grid,
                precision,
                row,
                col,
                items: upsert
                    ? { ...existingItems, ...providedItems }
                    : providedItems,
            });
        }
    }

    return grid;
}

/**
 * Updates the grid entry at the specified precision, row, and column with entities
 *
 * @param grid - The grid object.
 * @param precision - The precision level.
 * @param row - The row index.
 * @param col - The column index.
 * @param monsters - The monsters to update in the grid.
 * @param players - The players to update in the grid.
 * @param items - The items to update in the grid.
 * @returns The updated grid object.
 */
function updateGridEntry({
    grid,
    precision,
    row,
    col,
    monsters,
    players,
    items,
}: {
    grid: Grid;
    precision: number;
    row: number;
    col: number;
    monsters?: Record<string, Monster>;
    players?: Record<string, Player>;
    items?: Record<string, Item>;
}) {
    grid[precision] ??= {};
    grid[precision][row] ??= {};
    grid[precision][row][col] ??= {};

    if (monsters != null) {
        grid[precision][row][col].monsters = monsters;
    }

    if (players != null) {
        grid[precision][row][col].players = players;
    }

    if (items != null) {
        grid[precision][row][col].items = items;
    }
}

/**
 * Gets the grid cell coordinates for a given geohash.
 *
 * @param geohash - The geohash string.
 * @returns An object with the precision, row and column for the geohash in the grid.
 */
function geohashToGridCell(geohash: string): {
    precision: number;
    row: number;
    col: number;
} {
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
function gridCellToGeohash({
    precision,
    row,
    col,
}: {
    precision: number;
    row: number;
    col: number;
}): string {
    const lat = -(
        ((row + 0.5) / gridSizeAtPrecision[precision].rows) * 180 -
        90
    );
    const lon = ((col + 0.5) / gridSizeAtPrecision[precision].cols) * 360 - 180;
    return ngeohash.encode(lat, lon, precision);
}
