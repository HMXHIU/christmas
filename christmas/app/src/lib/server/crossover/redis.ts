import { createClient } from "redis";

import {
    REDIS_PASSWORD,
    REDIS_USERNAME,
    REDIS_HOST,
    REDIS_PORT,
} from "$env/static/private";
import { serverAnchorClient } from "..";
import { PublicKey } from "@solana/web3.js";

// Exports
export { redisClient, redisSubscribeClient, loadUserMetadataToRedis };

// Create clients
const redisClient = createClient({
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
    socket: {
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT),
        // TODO: use TLS see https://redis.io/docs/connect/clients/nodejs/
        // tls: true,
        // key: readFileSync("./redis_user_private.key"),
        // cert: readFileSync("./redis_user.crt"),
        // ca: [readFileSync("./redis_ca.pem")],
    },
});
const redisSubscribeClient = redisClient.duplicate();

// Load user metadata from storage to redis
async function loadUserMetadataToRedis(publicKey: string) {
    const user = await serverAnchorClient.getUser(new PublicKey(publicKey));

    if (user != null) {
    }

    // Read user metadata from nft storage
    // const userMetadata = await readUserMetadata(publicKey);
}

// Connect clients
if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Connected to Redis[pub]");
}
if (!redisSubscribeClient.isOpen) {
    await redisSubscribeClient.connect();
    console.log("Connected to Redis[sub]");
}
