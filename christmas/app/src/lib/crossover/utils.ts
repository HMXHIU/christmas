import { type Direction } from "$lib/crossover/world";
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
import { biomeAtGeohash } from "./world/biomes";
import { bestiary, biomes, compendium, worldSeed } from "./world/settings";

export {
    REGEX_STRIP_ENTITY_TYPE,
    borderingGeohashes,
    calculateLocation,
    childrenGeohashes,
    directionToVector,
    entityDimensions,
    entityId,
    gameActionId,
    geohashNeighbour,
    geohashesNearby,
    getPlotGeohashes,
    isGeohashTraversable,
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
 * Retrieves an array of geohashes representing a plot grid within a given geohash.
 * A plot is one whole geohash grid depending on the precision (4x8 or 8x4).
 *
 * @param geohash - The geohash to generate the plot grid from.
 * @param width - The width of the plot grid.
 * @param height - The height of the plot grid.
 * @returns An array of geohashes representing the plot grid.
 * @throws Error if the plot size is not a multiple of the calculated plot height and width.
 */
function getPlotGeohashes(
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
 * Checks if a geohash is traversable based on the provided items.
 *
 * TODO: include world colliders
 *
 * @param geohash - The geohash to check.
 * @param items - The items to check for colliders.
 * @returns A promise that resolves to a boolean indicating if the geohash is traversable.
 */
async function isGeohashTraversable(
    geohash: string,
    items: Item[],
): Promise<boolean> {
    // Check if geohash is traversable
    const biome = biomeAtGeohash(geohash);

    // Check any items with collider
    for (const itemEntity of items) {
        if (itemEntity.collider) {
            return false;
        }
    }

    return biomes[biome].traversableSpeed > 0;
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
 * Returns the ID of the given entity.
 *
 * @param entity - The entity (Player, Monster, or Item) for which to get the ID.
 * @returns The ID of the entity.
 */
function entityId(entity: Player | Monster | Item): string {
    if ("player" in entity) {
        return entity.player;
    } else if ("monster" in entity) {
        return entity.monster;
    } else {
        return entity.item;
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
