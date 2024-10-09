import { LRUMemoryCache } from "$lib/caches";

export {
    biomeAtGeohashCache,
    biomeParametersAtCityCache,
    blueprintsAtLocationCache,
    dungeonGraphCache,
    dungeonsAtTerritoryCache,
    isPublicKeyNPCCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
    worldAssetMetadataCache,
    worldPOIsCache,
    worldTraversableCellsCache,
};

// Caches
const topologyResultCache = new LRUMemoryCache({ max: 1000 }); // TODO: use redis cache
const topologyResponseCache = new LRUMemoryCache({ max: 100 }); // server can't use browser cache
const topologyBufferCache = new LRUMemoryCache({ max: 100 });
const worldAssetMetadataCache = new LRUMemoryCache({ max: 100 });
const worldPOIsCache = new LRUMemoryCache({ max: 100 });
const worldTraversableCellsCache = new LRUMemoryCache({ max: 100 });
const biomeAtGeohashCache = new LRUMemoryCache({ max: 1000 });
const biomeParametersAtCityCache = new LRUMemoryCache({ max: 1000 });
const dungeonGraphCache = new LRUMemoryCache({ max: 100 });
const dungeonsAtTerritoryCache = new LRUMemoryCache({ max: 100 });
const blueprintsAtLocationCache = new LRUMemoryCache({ max: 32 });
const isPublicKeyNPCCache = new LRUMemoryCache<boolean>({ max: 1000 });
