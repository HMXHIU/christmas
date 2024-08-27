import { type Direction, type GridCell } from "$lib/crossover/world/types";
import type {
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { divmod } from "$lib/utils";
import { flatten, pick } from "lodash-es";
import ngeohash from "ngeohash";
import type { GameAction } from "./ir";
import { actions } from "./world/actions";
import { MS_PER_TICK } from "./world/settings";
import { bestiary } from "./world/settings/bestiary";
import { compendium } from "./world/settings/compendium";
import { worldSeed } from "./world/settings/world";

export {
    autoCorrectGeohashPrecision,
    borderingGeohashes,
    calculateLocation,
    calculatePathDuration,
    childrenGeohashes,
    directionDuration,
    directionVectors,
    entityDimensions,
    entityInRange,
    evenGeohashCharacters,
    expandGeohashes,
    filterSortEntitiesInRange,
    gameActionId,
    generateEvenlySpacedPoints,
    geohashDistance,
    geohashesNearby,
    geohashNeighbour,
    geohashToColRow,
    geohashToGridCell,
    getAllUnitGeohashes,
    getEntityId,
    getGeohashesForPath,
    getPlotsAtGeohash,
    getPositionsForPath,
    gridCellToGeohash,
    gridSizeAtPrecision,
    inRange,
    isEntityInMotion,
    minifiedEntity,
    oddGeohashCharacters,
    REGEX_STRIP_ENTITY_TYPE,
    seededRandom,
    stringToRandomNumber,
};

const REGEX_STRIP_ENTITY_TYPE = /^(monster_|item_)/;

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

const evenColRow: Record<string, [number, number]> = {
    b: [0, 0],
    c: [1, 0],
    f: [2, 0],
    g: [3, 0],
    u: [4, 0],
    v: [5, 0],
    y: [6, 0],
    z: [7, 0],
    "8": [0, 1],
    "9": [1, 1],
    d: [2, 1],
    e: [3, 1],
    s: [4, 1],
    t: [5, 1],
    w: [6, 1],
    x: [7, 1],
    "2": [0, 2],
    "3": [1, 2],
    "6": [2, 2],
    "7": [3, 2],
    k: [4, 2],
    m: [5, 2],
    q: [6, 2],
    r: [7, 2],
    "0": [0, 3],
    "1": [1, 3],
    "4": [2, 3],
    "5": [3, 3],
    h: [4, 3],
    j: [5, 3],
    n: [6, 3],
    p: [7, 3],
};

const oddColRow: Record<string, [number, number]> = {
    p: [0, 0],
    r: [1, 0],
    x: [2, 0],
    z: [3, 0],
    n: [0, 1],
    q: [1, 1],
    w: [2, 1],
    y: [3, 1],
    j: [0, 2],
    m: [1, 2],
    t: [2, 2],
    v: [3, 2],
    h: [0, 3],
    k: [1, 3],
    s: [2, 3],
    u: [3, 3],
    "5": [0, 4],
    "7": [1, 4],
    e: [2, 4],
    g: [3, 4],
    "4": [0, 5],
    "6": [1, 5],
    d: [2, 5],
    f: [3, 5],
    "1": [0, 6],
    "3": [1, 6],
    "9": [2, 6],
    c: [3, 6],
    "0": [0, 7],
    "2": [1, 7],
    "8": [2, 7],
    b: [3, 7],
};

const invertedEvenColRow: Record<string, string> = Object.fromEntries(
    Object.entries(evenColRow).map(([char, [x, y]]) => [`${x},${y}`, char]),
);

const invertedOddColRow: Record<string, string> = Object.fromEntries(
    Object.entries(oddColRow).map(([char, [x, y]]) => [`${x},${y}`, char]),
);

/**
 * Converts a string (seed) to a random number.
 *
 * @param str - The string to convert.
 * @returns The random number generated from the string (seed).
 */
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

/**
 * Generates a seeded random number between 0 and 1.
 *
 * @param seed - The seed value used to generate the random number.
 * @returns A random number between 0 (inclusive) and 1 (exclusive).
 */
function seededRandom(seed: number): number {
    var x = Math.sin(seed) * 10000; // how many decimal places
    return x - Math.floor(x);
}

const directionVectors: Record<Direction, [number, number]> = {
    n: [-1, 0],
    s: [1, 0],
    e: [0, 1],
    w: [0, -1],
    ne: [-1, 1],
    nw: [-1, -1],
    se: [1, 1],
    sw: [1, -1],
    u: [0, 0],
    d: [0, 0], // Assuming "u" and "d" are placeholders for different layers, ignoring for 2D grid
};

/**
 * Auto-corrects the precision of a geohash by either truncating or extending it.
 *
 * @param geohash - The geohash to be corrected.
 * @param precision - The desired precision of the geohash.
 * @param rv - Random variable (0-1) if present will randomize the child geohash selected
 * @returns The corrected geohash with the specified precision.
 */
function autoCorrectGeohashPrecision(
    geohash: string,
    precision: number,
    rv?: number,
): string {
    if (geohash.length !== precision) {
        const delta = precision - geohash.length;
        if (delta > 0) {
            for (let i = 0; i < delta; i++) {
                if (rv == null) {
                    geohash = childrenGeohashes(geohash)[0];
                } else {
                    const gs = childrenGeohashes(geohash);
                    geohash = gs[Math.floor(rv * gs.length)];
                }
            }
        } else if (delta < 0) {
            geohash = geohash.slice(0, precision);
        }
    }
    return geohash;
}

/**
 * Gets the geohash neighbor in the given direction.
 *
 * @param geohash - The current geohash.
 * @param direction - The direction to get the neighbor geohash.
 * @param times - The number of times to perform operation (default to 1).
 * @returns The neighbor geohash in the given direction.
 */
function geohashNeighbour(
    geohash: string,
    direction: Direction,
    times?: number,
): string {
    times ??= 1;
    let v: [number, number] = [0, 0];

    if (direction === "n") {
        v = [1, 0];
    } else if (direction === "s") {
        v = [-1, 0];
    } else if (direction === "e") {
        v = [0, 1];
    } else if (direction === "w") {
        v = [0, -1];
    } else if (direction === "ne") {
        v = [1, 1];
    } else if (direction === "nw") {
        v = [1, -1];
    } else if (direction === "se") {
        v = [-1, 1];
    } else if (direction === "sw") {
        v = [-1, -1];
    } else {
        throw new Error(`Invalid direction: ${direction}`);
    }

    if (times > 1) {
        return geohashNeighbour(
            ngeohash.neighbor(geohash, v),
            direction,
            times - 1,
        );
    }
    return ngeohash.neighbor(geohash, v);
}

/**
 * Expands an array of geohashes to include parent geohashes up to a certain precision.
 *
 * @param geohashes - The array of geohashes to expand.
 * @param precision - The precision to expand the geohashes to.
 * @returns An array of expanded geohashes.
 */
function expandGeohashes(geohashes: string[], precision: number): string[] {
    return geohashes.flatMap((geohash) => {
        const expanded = [geohash];
        if (precision >= geohash.length) return expanded;
        for (let i = geohash.length - 1; i >= precision; i--) {
            expanded.push(geohash.slice(0, i));
        }
        return expanded;
    });
}

/**
 * Retrieves the bordering geohashes around `geohashes` exluding itself.
 *
 * @param geohashes - An array of geohashes.
 * @returns A promise that resolves to an array of bordering geohashes.
 */
async function borderingGeohashes(geohashes: string[]): Promise<string[]> {
    // Get all parent geohashes
    const innerGeohashes = new Set(geohashes);

    // Get all neighboring geohashes (exclude parent geohashes)
    const borderingGeohashes = new Set<string>();
    for (const geohash of innerGeohashes) {
        for (const neighborGeohash of ngeohash.neighbors(geohash)) {
            if (!innerGeohashes.has(neighborGeohash)) {
                borderingGeohashes.add(neighborGeohash);
            }
        }
    }
    return Array.from(borderingGeohashes);
}

/**
 * Retrieves the geohashes in the surroundings (24x20 or 20x24) of a given geohash (including itself).
 * If precision is odd, the geohash grid is 8x4, 8 neighbours will give 24x12 grid, add 3 more neighbours to the north and south
 * If precision is even, the geohash grid is 4x8, 8 neighbours will give 12x24 grid, add 3 more neighbours to the east and west
 *
 * @param geohash - The geohash for which to retrieve the surrounding geohashes.
 * @param square - Optional parameter to specify if the grid should be square (default is false).
 * @returns An array of geohashes including the original geohash and its surrounding geohashes.
 */
function geohashesNearby(geohash: string, square: boolean = false): string[] {
    const evenPrecision = geohash.length % 2;
    const [n, ne, e, se, s, sw, w, nw] = ngeohash.neighbors(geohash);

    if (!square) {
        return [geohash, n, ne, e, se, s, sw, w, nw];
    }

    const additionalNeghbours = evenPrecision
        ? [
              ngeohash.neighbor(w, [0, -1]),
              ngeohash.neighbor(nw, [0, -1]),
              ngeohash.neighbor(sw, [0, -1]),
              ngeohash.neighbor(e, [0, 1]),
              ngeohash.neighbor(ne, [0, 1]),
              ngeohash.neighbor(se, [0, 1]),
          ]
        : [
              ngeohash.neighbor(n, [1, 0]),
              ngeohash.neighbor(nw, [1, 0]),
              ngeohash.neighbor(ne, [1, 0]),
              ngeohash.neighbor(s, [-1, 0]),
              ngeohash.neighbor(sw, [-1, 0]),
              ngeohash.neighbor(se, [-1, 0]),
          ];

    return [geohash, n, ne, e, se, s, sw, w, nw, ...additionalNeghbours];
}

/**
 * Retrieves an array of plots at a given geohash (the parent of the geohash is 1 plot).
 * A plot is one whole geohash grid depending on the precision (4x8 or 8x4).
 * Multiple plots can be generated by specifying the width and height of the plot grid.
 *
 * @param geohash - The geohash to generate the plot grid from.
 * @param width - The width of the plot grid.
 * @param height - The height of the plot grid.
 * @returns An array of plot geohashes starting from the top left.
 */
function getPlotsAtGeohash(
    geohash: string,
    height: number,
    width: number,
): string[] {
    let geohashes: string[] = [];
    const parentGeohash = geohash.slice(0, -1);
    const parentGeohashIsEven = parentGeohash.length % 2 === 0;
    const plotHeight = parentGeohashIsEven ? 4 : 8;
    const plotWidth = parentGeohashIsEven ? 8 : 4;

    // Check plot size
    if (width % plotWidth !== 0 || height % plotHeight !== 0) {
        throw new Error(
            `Plot size must be a multiple of ${plotHeight} by ${plotWidth}`,
        );
    }
    let geohashRow = parentGeohash;
    for (let m = 0; m < height / plotHeight; m++) {
        let geohashCol = geohashRow;
        for (let n = 0; n < width / plotWidth; n++) {
            geohashes.push(geohashCol);
            geohashCol = geohashNeighbour(geohashCol, "e");
        }
        geohashRow = geohashNeighbour(geohashRow, "s");
    }

    return geohashes;
}

const oddGeohashCharacters = "bcfguvyz89destwx2367kmqr0145hjnp";
const evenGeohashCharacters = "prxznqwyjmtvhksu57eg46df139c028b";

/**
 * Generates an array of geohashes representing the children of the given geohash.
 * The order of the children starts from the top left.
 *
 * @param geohash - The geohash for which to generate children geohashes.
 * @returns An array of geohashes representing the children of the given geohash.
 */
function childrenGeohashes(geohash: string): string[] {
    if (geohash.length < 1) {
        throw new Error("Geohash must be at least length 1");
    }

    // if even geohash, add 1 odd geohash character
    if (geohash.length % 2 === 0) {
        return oddGeohashCharacters.split("").map((c) => {
            return geohash + c;
        });
    } else {
        return evenGeohashCharacters.split("").map((c) => {
            return geohash + c;
        });
    }
}

function getAllUnitGeohashes(geohash: string): string[] {
    if (geohash.length === worldSeed.spatial.unit.precision) {
        return [geohash];
    } else {
        return flatten(childrenGeohashes(geohash).map(getAllUnitGeohashes));
    }
}

/**
 * Calculates the dimensions of an entity.
 *
 * @param entity - The entity for which to calculate the dimensions.
 * @returns An object containing the width, height, and precision of the entity.
 * @throws {Error} If the entity is invalid.
 */
function entityDimensions(entity: Player | Monster | Item) {
    // Player
    if ((entity as Player).player) {
        return {
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        };
    }
    // Item
    else if ((entity as Item).item) {
        const { width, height, precision } =
            compendium[(entity as Item).prop].asset;
        return {
            width: width ?? 1,
            height: height ?? 1,
            precision: precision ?? worldSeed.spatial.unit.precision,
        };
    }
    // Monster
    else if ((entity as Monster).monster) {
        const { width, height, precision } =
            bestiary[(entity as Monster).beast].asset;
        return {
            width: width ?? 1,
            height: height ?? 1,
            precision: precision ?? worldSeed.spatial.unit.precision,
        };
    }

    throw new Error("Invalid entity");
}

/**
 * Calculates the location based on the given geohash, width, and height.
 *
 * @param geohash - The geohash string.
 * @param width - The width of the location.
 * @param height - The height of the location.
 * @returns An array of strings representing the calculated location.
 */
function calculateLocation(
    geohash: string,
    width: number,
    height: number,
): string[] {
    let location: string[] = [];
    let rowPivot = geohash;
    for (let i = 0; i < height; i++) {
        let colPivot = rowPivot;
        for (let j = 0; j < width; j++) {
            location.push(colPivot);
            if (j === width - 1) {
                break; // early break no need to get next `geohashNeighbour`
            }
            colPivot = geohashNeighbour(colPivot, "e");
        }
        if (i === height - 1) {
            break; // early break no need to get next `geohashNeighbour`
        }
        rowPivot = geohashNeighbour(rowPivot, "s");
    }
    return location;
}

/**
 * Returns the ID of the given entity and its type (player, monster, item).
 *
 * @param entity - The entity (Player, Monster, or Item) for which to get the ID.
 * @returns The ID of the entity and its type.
 */
function getEntityId(entity: Player | Monster | Item): [string, EntityType] {
    if ("player" in entity) {
        return [entity.player, "player"];
    } else if ("monster" in entity) {
        return [entity.monster, "monster"];
    } else {
        return [entity.item, "item"];
    }
}

function isEntityInMotion(entity: Player | Monster, now?: number): boolean {
    return entity.pthclk + entity.pthdur > (now ?? Date.now());
}

function minifiedEntity(
    entity: Player | Monster | Item,
    options?: {
        location?: boolean;
        stats?: boolean; // hp, mp, st, etc ...
        demographics?: boolean; // archetype, gender, race
        timers?: boolean; // apclk, buclk
        now?: number;
    },
): Player | Monster | Item {
    const [entityId, entityType] = getEntityId(entity);

    // Common
    let fields: string[] = ["name"];

    // Player specific
    if (entityType === "player") {
        fields.push("player");

        // Demographics
        if (options?.demographics) {
            fields.push("gen", "arch", "race");
        }
    }
    // Monster specific
    else if (entityType === "monster") {
        fields.push("monster", "beast");
    }
    // Item specific
    else {
        fields.push("item", "prop", "state", "vars");

        // Stats
        if (options?.stats) {
            fields.push("chg", "dur");
        }
    }

    // Monster & Player specific
    if (entityType === "player" || entityType === "monster") {
        // Path
        if (options?.location && isEntityInMotion(entity as Monster | Player)) {
            fields.push("pth", "pthst", "pthclk", "pthdur");
        }
        // Stats
        if (options?.stats) {
            fields.push("hp", "mp", "st", "ap");
        }
        // Timers
        if (options?.timers) {
            fields.push("apclk", "buclk"); // need to include ap
        }
    }

    // Location
    if (options?.location) {
        fields.push("loc", "locT");
    }

    return pick(entity, fields) as Player | Monster | Item;
}

/**
 * Returns the ID of a game action.
 *
 * @param gameAction The game action object.
 * @returns The ID of the game action.
 */
function gameActionId(gameAction: GameAction): string {
    if ("utility" in gameAction) {
        return gameAction.utility;
    } else if ("ability" in gameAction) {
        return gameAction.ability;
    } else {
        return gameAction.action;
    }
}

/**
 * Generates evenly spaced points within a cell.
 * @param {number} n - The number of points to generate.
 * @param {number} cellRadius - The radius of the cell.
 * @returns {Array<{x: number, y: number}>} An array of point coordinates.
 */
function generateEvenlySpacedPoints(n: number, cellRadius: number) {
    const points = [];
    const centerX = 0;
    const centerY = 0;
    const angle = (2 * Math.PI) / n;

    if (n % 2 === 1) {
        // Odd number of points
        points.push({ x: centerX, y: centerY }); // Center point
        const radius = cellRadius / (n + 1);
        for (let i = 0; i < n; i++) {
            const x = centerX + radius * Math.cos(i * angle);
            const y = centerY + radius * Math.sin(i * angle);
            points.push({ x, y });
        }
    } else {
        // Even number of points
        const radius = cellRadius / (n / 2 + 1);
        for (let i = 0; i < n; i += 2) {
            const x1 = centerX + radius * Math.cos((i / 2) * angle);
            const y1 = centerY + radius * Math.sin((i / 2) * angle);
            const x2 = centerX + radius * Math.cos((i / 2 + 1) * angle);
            const y2 = centerY + radius * Math.sin((i / 2 + 1) * angle);
            points.push({ x: x1, y: y1 }, { x: x2, y: y2 });
        }
    }

    return points;
}

function geohashToColRow(geohash: string): [number, number] {
    const precision = geohash.length;
    if (precision === 1) {
        return evenColRow[geohash];
    }
    const [xp, yp] = geohashToColRow(geohash.slice(0, -1));
    if ((precision - 1) % 2 === 0) {
        const [x, y] = evenColRow[geohash.slice(-1)];
        return [x + xp * 8, y + yp * 4];
    } else {
        const [x, y] = oddColRow[geohash.slice(-1)];
        return [x + xp * 4, y + yp * 8];
    }
}

/**
 * Gets the grid cell coordinates for a given geohash.
 *
 * @param geohash - The geohash string.
 * @returns An object with the precision, row and column for the geohash in the grid.
 */
function geohashToGridCell(geohash: string): GridCell {
    const precision = geohash.length;
    const [col, row] = geohashToColRow(geohash);
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
    col,
    row,
    precision,
}: {
    col: number;
    row: number;
    precision: number;
}): string {
    const geohashStr: string[] = [];
    for (let i = precision - 1; i >= 0; i--) {
        let char: string;
        if (i % 2 === 0) {
            // Even precision levels use evenColRow
            const [subCol, remainderCol] = divmod(col, 8);
            const [subRow, remainderRow] = divmod(row, 4);
            char = invertedEvenColRow[`${remainderCol},${remainderRow}`];
            if (char === undefined) {
                throw new Error(
                    `Invalid coordinate for even level: ${remainderCol},${remainderRow}`,
                );
            }
            col = subCol;
            row = subRow;
        } else {
            // Odd precision levels use oddColRow
            const [subCol, remainderCol] = divmod(col, 4);
            const [subRow, remainderRow] = divmod(row, 8);
            char = invertedOddColRow[`${remainderCol},${remainderRow}`];
            if (char === undefined) {
                throw new Error(
                    `Invalid coordinate for odd level: ${remainderCol},${remainderRow}`,
                );
            }
            col = subCol;
            row = subRow;
        }

        geohashStr.push(char);
    }

    return geohashStr.reverse().join("");
}

function getPositionsForPath(
    start: { row: number; col: number },
    path: Direction[],
): { row: number; col: number }[] {
    const positions: { row: number; col: number }[] = [start];
    let row = start.row;
    let col = start.col;
    for (const direction of path) {
        const [dr, dc] = directionVectors[direction];
        row += dr;
        col += dc;
        positions.push({ row, col });
    }
    return positions;
}

/**
 * Retrieves an array of geohashes based on a starting geohash and a path of directions.
 *
 * @param geohash The starting geohash.
 * @param path An array of directions.
 * @returns An array of geohashes.
 */
function getGeohashesForPath(geohash: string, path: Direction[]): string[] {
    const geohashes: string[] = [geohash];
    let currentGeohash = geohash;
    for (const direction of path) {
        currentGeohash = geohashNeighbour(currentGeohash, direction);
        geohashes.push(currentGeohash);
    }
    return geohashes;
}

function entityInRange(
    self: Player | Monster,
    target: Player | Monster | Item,
    range: number,
    diagonal: boolean = true,
): [boolean, number] {
    // If the target is not a geohash, check if the target is on self
    if (target.locT !== "geohash") {
        // Allow targeting items on self
        if (target.loc[0] === getEntityId(self)[0]) {
            return [true, 0];
        }
        // Not allowed to target items on other entities
        else {
            // TODO: should targetting other player's items be supported ???
            return [false, 0];
        }
    }

    const { row: r1, col: c1 } = geohashToGridCell(self.loc[0]);
    const { row: r2, col: c2 } = geohashToGridCell(target.loc[0]);

    return inRange({ r1, c1, r2, c2, range, diagonal });
}

function geohashDistance(geohash1: string, geohash2: string): number {
    const [col1, row1] = geohashToColRow(geohash1);
    const [col2, row2] = geohashToColRow(geohash2);
    return Math.sqrt(Math.pow(col2 - col1, 2) + Math.pow(row2 - row1, 2));
}

function inRange({
    r1,
    c1,
    r2,
    c2,
    range,
    diagonal,
}: {
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    range: number;
    diagonal?: boolean;
}): [boolean, number] {
    if (diagonal) {
        const deltaX = Math.abs(r1 - r2);
        const deltaY = Math.abs(c1 - c2);
        const chebyshevDistance = Math.max(deltaX, deltaY);
        return [range < 0 || chebyshevDistance <= range, deltaX + deltaY];
    } else {
        const deltaX = r1 - r2;
        const deltaY = c1 - c2;
        const squaredDistance = deltaX * deltaX + deltaY * deltaY;
        const squaredRange = range * range;
        return [range < 0 || squaredDistance <= squaredRange, squaredDistance];
    }
}

function filterSortEntitiesInRange(
    self: Player | Monster,
    entities: (Player | Monster | Item)[],
    range: number,
) {
    return entities
        .map((entity) => {
            const [inRange, distance] = entityInRange(self, entity, range);
            return { inRange, distance, entity };
        })
        .filter(({ inRange }) => inRange)
        .sort((a, b) => {
            return a.distance - b.distance; // ascending order
        })
        .map(({ entity }) => entity);
}

function directionDuration(d: Direction): number {
    if (d === "n" || d === "s" || d === "e" || d === "w") {
        return actions.move.ticks * MS_PER_TICK;
    } else {
        return actions.move.ticks * MS_PER_TICK * 1.414;
    }
}

function calculatePathDuration(path: Direction[]): number {
    let dur = 0;
    for (const d of path) {
        dur += directionDuration(d);
    }
    return Math.round(dur);
}
