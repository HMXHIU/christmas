import { CacheInterface } from "$lib/caches";
import { type RedisClientType } from "redis";

export { RedisCache };

class RedisCache extends CacheInterface {
    client: RedisClientType;

    constructor(client: RedisClientType) {
        super();
        this.client = client;
    }

    async get(key: string): Promise<any> {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }

    async set(key: string, value: any) {
        await this.client.set(key, JSON.stringify(value));
    }

    async delete(key: string) {
        await this.client.del(key);
    }
}
