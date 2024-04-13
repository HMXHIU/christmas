import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import type { TileSchema } from "$lib/server/crossover/router";
import lodash from "lodash";
import ngeohash from "ngeohash";
import type { z } from "zod";
import { biomesNearbyGeohash } from "./biomes";
import { type EquipmentSlot } from "./compendium";
const { groupBy } = lodash;

export {
    abyssTile,
    geohashToGridCell,
    loadMoreGridBiomes,
    updateGrid,
    updateGridEntry,
    type AssetMetadata,
    type Direction,
    type Grid,
    type LocationType,
    type WorldSeed,
};

const abyssTile: z.infer<typeof TileSchema> = {
    name: "The Abyss",
    geohash: "59ke577h",
    description: "You are nowhere to be found.",
};

interface AssetMetadata {
    bundle: string;
    name: string;
    animations?: Record<string, string>; // create an animation pointing to an in the sprite.json
    variants?: Record<string, string>; // create a variant pointing to a frame in the sprite.json
    width: number; // number of horizontal cells at the geohash precision
    height: number; // number of vertical cells at the geohash precision
    precision: number; // geohash precision
}

type Direction = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "u" | "d";

type LocationType =
    | "geohash"
    | "item"
    | "inv" // inventory
    | EquipmentSlot;

interface GridEntry {
    biome?: string; // can be procedurally generated at client
    monsters?: Record<string, Monster>; // needs to be fetched from server (spawned by dungeon master)
    players?: Record<string, Player>; // needs to be fetched from server
    items?: Record<string, Item>; // needs to be fetched from server
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
 * Loads more grid data (biome only) based on the given geohash and grid.
 *
 * @param geohash - The current geohash to load more grid data for.
 * @param grid - The current grid data.
 * @returns The updated grid data.
 */
function loadMoreGridBiomes(geohash: string, grid: Grid): Grid {
    const parentGeohash = geohash.slice(0, -1);

    // Update grid with biomes
    const biomes = biomesNearbyGeohash(parentGeohash);
    grid = updateGrid({ grid, biomes });

    // Get neighbor geohashes of parent
    ngeohash.neighbors(parentGeohash).forEach((neighborGeohash) => {
        // Update grid with biomes if not previously loaded
        const biomes = biomesNearbyGeohash(neighborGeohash);
        grid = updateGrid({ grid, biomes });
    });

    return grid;
}

/**
 * Updates (recreate at geohash) or Upserts the provided grid with biomes, monsters, players, and items.
 *
 * @param grid - The grid to update with biomes.
 * @param upsert - Whether to upsert the provided monsters, players, and items (default: false).
 * @param biomes - Record of geohash strings to biome names.
 * @param monsters - Array of monsters to add to the grid.
 * @param players - Array of players to add to the grid.
 * @param items - Array of items to add to the grid.
 * @returns The updated grid.
 */
function updateGrid({
    grid,
    biomes,
    monsters,
    players,
    items,
    upsert = false,
}: {
    grid: Grid;
    biomes?: Record<string, string>;
    monsters?: Monster[];
    players?: Player[];
    items?: Item[];
    upsert?: boolean;
}) {
    // Update biomes
    if (biomes) {
        for (const [geohash, biome] of Object.entries(biomes)) {
            const { precision, row, col } = geohashToGridCell(geohash);
            updateGridEntry({
                grid,
                precision,
                row,
                col,
                biome,
            });
        }
    }

    // Delete monsters, players, and items from grid (relocated)
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
 * Updates the grid entry at the specified precision, row, and column with the provided monsters and biome.
 * If monsters or biome are not provided, they will not be updated.
 *
 * @param grid - The grid object.
 * @param precision - The precision level.
 * @param row - The row index.
 * @param col - The column index.
 * @param monsters - The monsters to update in the grid.
 * @param biome - The biome to update in the grid.
 */
function updateGridEntry({
    grid,
    precision,
    row,
    col,
    monsters,
    players,
    items,
    biome,
}: {
    grid: Grid;
    precision: number;
    row: number;
    col: number;
    monsters?: Record<string, Monster>;
    players?: Record<string, Player>;
    items?: Record<string, Item>;
    biome?: string;
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

    if (biome != null) {
        grid[precision][row][col].biome = biome;
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
