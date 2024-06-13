import ngeohash from "ngeohash";
import type { GridCell } from "./types";

export { geohashToGridCell, gridCellToGeohash, gridSizeAtPrecision };

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

    return { precision, row, col, geohash };
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
