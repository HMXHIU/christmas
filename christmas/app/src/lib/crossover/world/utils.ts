import type { CacheInterface } from "$lib/caches";
import type { World } from "$lib/crossover/types";
import { biomeAtGeohash, biomes } from "./biomes";
import type { GeohashLocation } from "./types";
import { traversableSpeedInWorld } from "./world";

export { isGeohashTraversable };

async function isGeohashTraversable(
    geohash: string,
    locationType: GeohashLocation,
    locationInstance: string,
    hasCollidersInGeohash: (
        geohash: string,
        locationType: GeohashLocation,
        locationInstance: string,
    ) => Promise<boolean>,
    getWorldForGeohash: (
        geohash: string,
        locationType: GeohashLocation,
    ) => Promise<World | undefined>,
    options?: {
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
        topologyResponseCache?: CacheInterface;
        worldAssetMetadataCache?: CacheInterface;
        worldTraversableCellsCache?: CacheInterface;
        biomeAtGeohashCache?: CacheInterface;
        biomeParametersAtCityCache?: CacheInterface;
        dungeonGraphCache?: CacheInterface;
        dungeonsAtTerritoryCache?: CacheInterface;
    },
): Promise<boolean> {
    // Early return false if has colliders (items)
    if (await hasCollidersInGeohash(geohash, locationType, locationInstance)) {
        return false;
    }

    // Get biome speed
    const [biome, strength] = await biomeAtGeohash(geohash, locationType, {
        topologyResultCache: options?.topologyResultCache,
        topologyBufferCache: options?.topologyBufferCache,
        topologyResponseCache: options?.topologyResponseCache,
        biomeAtGeohashCache: options?.biomeAtGeohashCache,
        biomeParametersAtCityCache: options?.biomeParametersAtCityCache,
        dungeonGraphCache: options?.dungeonGraphCache,
        dungeonsAtTerritoryCache: options?.dungeonsAtTerritoryCache,
    });
    const biomeSpeed = biomes[biome].traversableSpeed;

    // Get world speed
    let worldSpeed = undefined;
    const world = await getWorldForGeohash(geohash, locationType);
    if (world) {
        worldSpeed = await traversableSpeedInWorld({
            world,
            geohash,
            worldAssetMetadataCache: options?.worldAssetMetadataCache,
            worldTraversableCellsCache: options?.worldTraversableCellsCache,
        });
    }

    // worldSpeed overwrites biomeSpeed if present
    const finalSpeed = worldSpeed ?? biomeSpeed;
    return finalSpeed > 0;
}
