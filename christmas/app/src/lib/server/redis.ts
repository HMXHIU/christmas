import {
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    REDIS_USERNAME,
} from "$env/static/private";
import { createClient } from "redis";

export { initializeRedisClients, redisClient, redisSubscribeClient };

// Create redis pub sub clients
const redisClient = createClient({
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
    socket: {
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT),
    },
});
const redisSubscribeClient = redisClient.duplicate();

async function initializeRedisClients(
    callback?: (redisClient: any) => Promise<void>,
) {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
            console.info("Connected to Redis[pub]");
        }
        if (!redisSubscribeClient.isOpen) {
            await redisSubscribeClient.connect();
            console.info("Connected to Redis[sub]");
        }
        if (callback) {
            await callback(redisClient);
        }
    } catch (error: any) {
        // During build time it does not have connection to redis
        console.error(`Failed to initialize redis clients: ${error.message}`);
    }
}
