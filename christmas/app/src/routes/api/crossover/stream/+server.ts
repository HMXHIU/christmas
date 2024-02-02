import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createClient } from "redis";

import {
    REDIS_PASSWORD,
    REDIS_USERNAME,
    REDIS_HOST,
    REDIS_PORT,
    ENVIRONMENT,
} from "$env/static/private";

const pubClient = createClient({
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
    socket: {
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT),
        // (TODO: use TLS see https://redis.io/docs/connect/clients/nodejs/)
        // tls: true,
        // key: readFileSync("./redis_user_private.key"),
        // cert: readFileSync("./redis_user.crt"),
        // ca: [readFileSync("./redis_ca.pem")],
    },
});
const subClient = pubClient.duplicate();

let userStreams: Record<string, any> = {};

export const GET: RequestHandler = ({ url }) => {
    // Authenticate user
    const userId = "userId";

    // Get user stream
    const stream = new ReadableStream({
        start(controller) {
            userStreams[userId] = controller;
            console.log(`Stream ${userId} started`);
        },
        cancel() {
            delete userStreams[userId];
            console.log(`Stream ${userId} ended`);
        },
    });

    // userStreams[userId].enqueue("data: Hello world \n\n");

    return new Response(stream, {
        headers: {
            // Denotes the response as SSE
            "Content-Type": "text/event-stream",
            // Optional. Request the GET request not to be cached.
            "Cache-Control": "no-cache",
        },
    });
};

// Connect to Redis
if (!pubClient.isOpen) {
    await pubClient.connect();
    console.log("Connected to Redis[pub]");
}

if (!subClient.isOpen) {
    await subClient.connect();
    console.log("Connected to Redis[sub]");

    subClient.subscribe("message", (message) => {
        console.log(`Received message: ${message}`);
        for (const stream of Object.values(userStreams)) {
            stream.enqueue(`data: ${message}\n\n`);
        }
    });
}

let counter = 0;

// create infinite loop with sleep of 1 second and publish message to redis
setInterval(() => {
    pubClient.publish("message", `Hello world: ${counter}`);
    console.log("Published message to Redis");
    counter++;
}, 1000);
