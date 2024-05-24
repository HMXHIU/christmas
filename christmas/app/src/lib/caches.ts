export { BrowserCache, CacheInterface, LocalStorageCache, MemoryCache };

class CacheInterface {
    // Works with LRUCache
    async get(key: string): Promise<any> {}
    async set(key: string, value: any) {}
    async delete(key: string) {}
}

class MemoryCache extends CacheInterface {
    cache: Map<string, any>;

    constructor() {
        super();
        this.cache = new Map();
    }

    async get(key: string): Promise<any> {
        return this.cache.get(key);
    }

    async set(key: string, value: any) {
        this.cache.set(key, value);
    }

    async delete(key: string) {
        this.cache.delete(key);
    }
}

class LocalStorageCache extends CacheInterface {
    async get(key: string) {
        const s = localStorage.getItem(key);
        if (s == null) {
            return null;
        }
        return JSON.parse(s);
    }

    async set(key: string, value: any) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    async delete(key: string) {
        localStorage.removeItem(key);
    }
}

class BrowserCache {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    async get(key: string): Promise<Response | null> {
        const cache = await self.caches.open(this.name);
        return (await cache.match(key)) || null;
    }

    async set(key: string, value: Response) {
        const cache = await self.caches.open(this.name);
        await cache.put(key, value);
    }

    async delete(key: string) {
        const cache = await self.caches.open(this.name);
        await cache.delete(key);
    }
}
