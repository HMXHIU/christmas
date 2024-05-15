import { type Direction, type EntityType } from "$lib/crossover/world";
import type {
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import ngeohash from "ngeohash";
import type { GameAction } from "./ir";
import { bestiary, compendium, worldSeed } from "./world/settings";

export {
    REGEX_STRIP_ENTITY_TYPE,
    autoCorrectGeohashPrecision,
    borderingGeohashes,
    calculateLocation,
    cartToIso,
    childrenGeohashes,
    directionToVector,
    entityDimensions,
    entityId,
    expandGeohashes,
    gameActionId,
    geohashNeighbour,
    geohashesNearby,
    getPlotsAtGeohash,
    seededRandom,
    stringToRandomNumber,
};

const REGEX_STRIP_ENTITY_TYPE = /^(monster_|item_)/;

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

/**
 * Rotate clockwise by 45 degrees, scale vertically by 0.5
 *
 * [x, y] * [ 0.5  0.25 ]
 *          [ -0.5 0.25 ]
 */
function cartToIso(x: number, y: number) {
    return [x * 0.5 + y * -0.5, x * 0.25 + y * 0.25];
}

/**
 * Converts a direction to a vector.
 *
 * @param direction - The direction to convert.
 * @returns The vector representation of the direction.
 * @throws {Error} If the direction is invalid.
 */
function directionToVector(direction: Direction): [number, number] {
    if (direction === "n") {
        return [1, 0];
    } else if (direction === "s") {
        return [-1, 0];
    } else if (direction === "e") {
        return [0, 1];
    } else if (direction === "w") {
        return [0, -1];
    } else if (direction === "ne") {
        return [1, 1];
    } else if (direction === "nw") {
        return [1, -1];
    } else if (direction === "se") {
        return [-1, 1];
    } else if (direction === "sw") {
        return [-1, -1];
    }
    throw new Error(`Invalid direction: ${direction}`);
}

/**
 * Auto-corrects the precision of a geohash by either truncating or extending it.
 *
 * @param geohash - The geohash to be corrected.
 * @param precision - The desired precision of the geohash.
 * @returns The corrected geohash with the specified precision.
 */
function autoCorrectGeohashPrecision(
    geohash: string,
    precision: number,
): string {
    if (geohash.length !== precision) {
        const delta = precision - geohash.length;
        if (delta > 0) {
            for (let i = 0; i < delta; i++) {
                geohash = childrenGeohashes(geohash)[0];
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
    const d = directionToVector(direction);
    if (times > 1) {
        return geohashNeighbour(
            ngeohash.neighbor(geohash, d),
            direction,
            times - 1,
        );
    }
    return ngeohash.neighbor(geohash, d);
}

/**
 * Expands an array of geohashes to include parent geoahses up to a certain precision.
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
 * If precision is odd, the geohash grid is 8x4, 8 neighbours will give 24x12 grid, add 3 more neighbours to the east and west
 * If precision is even, the geohash grid is 4x8, 8 neighbours will give 12x24 grid, add 3 more neighbours to the north and south
 *
 * @param geohash - The geohash for which to retrieve the surrounding geohashes.
 * @returns An array of geohashes including the original geohash and its surrounding geohashes.
 */
function geohashesNearby(geohash: string): string[] {
    const evenPrecision = geohash.length % 2;
    const [n, ne, e, se, s, sw, w, nw] = ngeohash.neighbors(geohash);
    const additionalNeghbours = evenPrecision
        ? [
              ngeohash.neighbor(n, [1, 0]),
              ngeohash.neighbor(nw, [1, 0]),
              ngeohash.neighbor(ne, [1, 0]),
              ngeohash.neighbor(s, [-1, 0]),
              ngeohash.neighbor(sw, [-1, 0]),
              ngeohash.neighbor(se, [-1, 0]),
          ]
        : [
              ngeohash.neighbor(w, [0, -1]),
              ngeohash.neighbor(nw, [0, -1]),
              ngeohash.neighbor(sw, [0, -1]),
              ngeohash.neighbor(e, [0, 1]),
              ngeohash.neighbor(ne, [0, 1]),
              ngeohash.neighbor(se, [0, 1]),
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

    if (geohash.length % 2 === 0) {
        return "bcfguvyz89destwx2367kmqr0145hjnp".split("").map((c) => {
            return geohash + c;
        });
    } else {
        return "prxznqwyjmtvhksu57eg46df139c028b".split("").map((c) => {
            return geohash + c;
        });
    }
}

/**
 * Calculates the dimensions of an entity.
 *
 * @param entity - The entity for which to calculate the dimensions.
 * @returns An object containing the width, height, and precision of the entity.
 * @throws {Error} If the entity is invalid.
 */
function entityDimensions(entity: PlayerEntity | MonsterEntity | ItemEntity) {
    if (entity.player) {
        return {
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        };
    } else if (entity.item) {
        const { width, height, precision } =
            compendium[(entity as ItemEntity).prop].asset;
        return { width, height, precision };
    } else if (entity.monster) {
        const { width, height, precision } =
            bestiary[(entity as MonsterEntity).beast].asset;
        return { width, height, precision };
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
function entityId(entity: Player | Monster | Item): [string, EntityType] {
    if ("player" in entity) {
        return [entity.player, "player"];
    } else if ("monster" in entity) {
        return [entity.monster, "monster"];
    } else {
        return [entity.item, "item"];
    }
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
