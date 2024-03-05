import { createClient } from "redis";

import {
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    REDIS_USERNAME,
} from "$env/static/private";
import { Repository } from "redis-om";
import { PlayerEntitySchema } from "./entities";

// Exports
export { playerRepository, redisClient, redisSubscribeClient };

// Repositories
let playerRepository: Repository;

// Create clients
const redisClient = createClient({
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
    socket: {
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT),
    },
});
const redisSubscribeClient = redisClient.duplicate();

// Connect clients
if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Connected to Redis[pub]");

    // Register Schemas
    registerSchemas();
}
if (!redisSubscribeClient.isOpen) {
    await redisSubscribeClient.connect();
    console.log("Connected to Redis[sub]");
}

function registerSchemas() {
    console.log("Registering redis schemas");
    playerRepository = new Repository(PlayerEntitySchema, redisClient);
}
