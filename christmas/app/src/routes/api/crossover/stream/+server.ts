import type { RequestHandler } from "./$types";
import { redisClient, redisSubscribeClient } from "$lib/server/crossover/redis";
import { connectedUsers } from "$lib/server/crossover";

export const GET: RequestHandler = ({ url }) => {
    // Authenticate user
    const publicKey = "publicKey";

    // Get user stream
    const stream = new ReadableStream({
        start(controller) {
            connectedUsers[publicKey] = { stream: controller, publicKey };
            console.log(`Stream ${publicKey} started`);
        },
        cancel() {
            delete connectedUsers[publicKey];
            console.log(`Stream ${publicKey} ended`);
        },
    });

    return new Response(stream, {
        headers: {
            // Denotes the response as SSE
            "Content-Type": "text/event-stream",
            // Optional. Request the GET request not to be cached.
            "Cache-Control": "no-cache",
        },
    });
};

// Subscribe to redis `message` channel
redisSubscribeClient.subscribe("message", (message) => {
    console.log(`Received message: ${message}`);
    // Send relevant messages to connected users
    for (const user of Object.values(connectedUsers)) {
        user.stream.enqueue(`data: ${message}\n\n`);
    }
});

// let counter = 0;

// // TESTING create infinite loop with sleep of 1 second and publish message to redis
// setInterval(() => {
//     redisClient.publish("message", `Hello world: ${counter}`);
//     console.log("Published message to Redis");
//     counter++;
// }, 1000);
