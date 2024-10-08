import { BrowserCache, CacheInterface, LRUMemoryCache } from "$lib/caches";
import { isBrowser } from "$lib/utils";

export {
    biomeAtGeohashCache,
    biomeParametersAtCityCache,
    blueprintsAtTerritoryCache,
    dungeonGraphCache,
    dungeonsAtTerritoryCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
    worldAssetMetadataCache,
    worldTraversableCellsCache,
};

// Caches
const topologyResultCache = new LRUMemoryCache({ max: 1000 });
const topologyResponseCache: CacheInterface = isBrowser()
    ? new BrowserCache("topology")
    : new LRUMemoryCache({ max: 100 });
const topologyBufferCache = new LRUMemoryCache({ max: 100 });
const worldAssetMetadataCache = new LRUMemoryCache({ max: 100 });
const worldTraversableCellsCache = new LRUMemoryCache({ max: 100 });
const biomeAtGeohashCache = new LRUMemoryCache({ max: 100 });
const biomeParametersAtCityCache = new LRUMemoryCache({ max: 100 });
const dungeonGraphCache = new LRUMemoryCache({ max: 10 });
const dungeonsAtTerritoryCache = new LRUMemoryCache({ max: 10 });
const blueprintsAtTerritoryCache = new LRUMemoryCache({ max: 32 });
