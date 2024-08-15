import { BrowserCache, LRUMemoryCache } from "$lib/caches";
import { isBrowser } from "$lib/utils";

export {
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
    worldAssetMetadataCache,
    worldTraversableCellsCache,
};

// Caches
const topologyResultCache = new LRUMemoryCache({ max: 1000 });
const topologyResponseCache = isBrowser()
    ? new BrowserCache("topology")
    : new LRUMemoryCache({ max: 100 });
const topologyBufferCache = new LRUMemoryCache({ max: 100 });
const worldAssetMetadataCache = new LRUMemoryCache({ max: 100 });
const worldTraversableCellsCache = new LRUMemoryCache({ max: 100 });
