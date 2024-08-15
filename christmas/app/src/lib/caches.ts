import { LRUCache } from "lru-cache";

export {
    BrowserCache,
    CacheInterface,
    LocalStorageCache,
    LRUMemoryCache,
    memoize,
    MemoryCache,
};

function memoize<T, A extends any[]>(
    func: (...args: A) => Promise<T>,
    cache: CacheInterface,
    resolver: (...args: A) => string,
): (...args: A) => Promise<T> {
    return async (...args: A): Promise<T> => {
        const key = resolver(...args);
        const cachedResult = await cache.get(key);
        if (cachedResult !== undefined) {
            return cachedResult;
        }
        const result = await func(...args);
        await cache.set(key, result);
        return result;
    };
}

class CacheInterface {
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

class LRUMemoryCache extends CacheInterface {
    cache: LRUCache<string, any>;

    constructor(options: any) {
        super();
        this.cache = new LRUCache(options);
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

class BrowserCache extends CacheInterface {
    name: string;

    constructor(name: string) {
        super();
        this.name = name;
    }

    async get(key: string): Promise<Response | null> {
        if (!self) return null; // not in browser environment
        const cache = await self.caches.open(this.name);
        return (await cache.match(key)) || null;
    }

    async set(key: string, value: Response) {
        if (!self) return; // not in browser environment
        const cache = await self.caches.open(this.name);
        await cache.put(key, value);
    }

    async delete(key: string) {
        if (!self) return; // not in browser environment
        const cache = await self.caches.open(this.name);
        await cache.delete(key);
    }
}
