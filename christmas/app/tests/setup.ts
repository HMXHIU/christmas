import { initializeCommunityRedisRepositories } from "$lib/server/community/redis";
import { initializeCrossoverRedisRepositories } from "$lib/server/crossover/redis";
import { initializeRedisClients } from "$lib/server/redis";
import { sleep } from "$lib/utils";

export default async function () {
    // Initialize redis clients, repositiories, indexes
    initializeRedisClients(async (redisClient) => {
        await initializeCrossoverRedisRepositories(redisClient);
        await initializeCommunityRedisRepositories(redisClient);
    });

    await sleep(100);

    return async () => {};
}
