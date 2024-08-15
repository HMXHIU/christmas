import { BrowserCache, LRUMemoryCache } from "$lib/caches";

export {
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
    worldAssetMetadataCache,
    worldTraversableCellsCache,
};

// Caches
const topologyResultCache = new LRUMemoryCache({ max: 1000 });
const topologyResponseCache = new BrowserCache("topology");
const topologyBufferCache = new LRUMemoryCache({ max: 100 });
const worldAssetMetadataCache = new LRUMemoryCache({ max: 100 });
const worldTraversableCellsCache = new LRUMemoryCache({ max: 100 });
