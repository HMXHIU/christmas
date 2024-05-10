import { seededRandom, stringToRandomNumber } from "$lib/crossover/utils";
import ngeohash from "ngeohash";
import { type AssetMetadata, type WorldSeed } from ".";
import { biomes, worldSeed } from "./settings";
export {
    biomeAtGeohash,
    biomesNearbyGeohash,
    tileAtGeohash,
    type Biome,
    type Tile,
};

interface Biome {
    biome: string;
    name: string;
    description: string;
    traversableSpeed: number; // 0.0 - 1.0
    asset?: AssetMetadata;
}

interface Tile {
    geohash: string;
    name: string;
    description: string;
}

/**
 * Determines the biome name at the given geohash based on probabilities configured in the world seed.
 *
 * @param geohash - The geohash coordinate string
 * @param seed - Optional world seed to use. Defaults to globally set seed.
 * @returns The name of the biome determined for that geohash.
 *
 * TODO: Add caching to avoid redundant calls to biomeAtGeohash().
 *
 */
function biomeAtGeohash(geohash: string, seed?: WorldSeed): string {
    seed = seed || worldSeed;

    // Leave h9* for ice for testing (fully traversable)
    if (geohash.startsWith("h9")) {
        return biomes.ice.biome;
    }

    const continent = geohash.charAt(0);
    const probBio = seed.seeds.continent[continent].bio;
    const probWater = seed.seeds.continent[continent].water;
    const totalProb = probBio + probWater;

    // Use the geohash as the random seed (must be reproducible)
    const rv = seededRandom(stringToRandomNumber(geohash)) * totalProb;

    // Select biome
    if (rv < probBio) {
        return biomes.forest.biome;
    }
    if (rv < probBio + probWater) {
        return biomes.water.biome;
    }
    return biomes.plains.biome;
}

/**
 * Generates biomes in the vincinity of the given geohash by iterating
 * over all child geohashes at a precision 1 higher than the given geohash
 *
 * @param geohash - The geohash geohash to generate biomes for.
 * @param seed - Optional world seed.
 * @returns A record of geohash to biomes generated with biomeAtGeohash().
 */
function biomesNearbyGeohash(
    geohash: string,
    seed?: WorldSeed,
): Record<string, string> {
    seed = seed || worldSeed;

    const [minlat, minlon, maxlat, maxlon] = ngeohash.decode_bbox(geohash);

    // Get all the geohashes 1 precision higher than the geohash
    const geohashes = ngeohash.bboxes(
        minlat,
        minlon,
        maxlat,
        maxlon,
        geohash.length + 1,
    );

    return geohashes.reduce((obj: any, geohash) => {
        obj[geohash] = biomeAtGeohash(geohash, seed);
        return obj;
    }, {});
}

/**
 * Retrieves the tile information based on the given geohash and biome.
 *
 * @param geohash - The geohash representing the location of the tile.
 * @param biome - The biome of the tile.
 * @returns The tile information including geohash, name, and description.
 */
function tileAtGeohash(geohash: string, biome: string): Tile {
    let description = "";

    switch (biome) {
        case "forest":
            description =
                "A dense collection of trees and vegetation, home to a variety of wildlife.";
            break;
        case "desert":
            description =
                "A dry, arid region with extreme temperatures, sparse vegetation, and limited wildlife.";
            break;
        case "tundra":
            description =
                "A cold, treeless area with a frozen subsoil, limited vegetation, and adapted wildlife.";
            break;
        case "grassland":
            description =
                "A region dominated by grasses, with few trees and a diverse range of wildlife.";
            break;
        case "wetland":
            description =
                "An area saturated with water, supporting aquatic plants and a rich biodiversity.";
            break;
        case "mountain":
            description =
                "A high elevation region with steep terrain, diverse ecosystems, and unique wildlife.";
            break;
        default:
            description = "Unknown biome";
            break;
    }
    return {
        geohash,
        name: geohash, // TODO: get name from POI
        description: description,
    };
}
