import { LRUMemoryCache } from "$lib/caches";

export { topologyBufferCache, topologyResponseCache, topologyResultCache };

// Caches
const topologyResultCache = new LRUMemoryCache({ max: 1000 }); // TODO: use redis cache
const topologyResponseCache = new LRUMemoryCache({ max: 100 }); // server can't use browser cache
const topologyBufferCache = new LRUMemoryCache({ max: 100 });
