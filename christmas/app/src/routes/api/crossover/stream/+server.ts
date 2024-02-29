import type { RequestHandler } from "./$types";
import { redisSubscribeClient } from "$lib/server/crossover/redis";
import { connectedUsers } from "$lib/server/crossover";
import { requireLogin } from "$lib/server";

export const GET: RequestHandler = (event) => {
    const user = requireLogin(event);

    // Create a register user stream on this server instance
    const stream = new ReadableStream({
        start(controller) {
            connectedUsers[user.publicKey] = {
                stream: controller,
                publicKey: user.publicKey,
            };
            console.log(`Stream ${user.publicKey} started`);
            controller.enqueue(
                JSON.stringify({
                    type: "system",
                    data: { event: "stream", message: "started" },
                }),
            );
        },
        cancel() {
            delete connectedUsers[user.publicKey];
            console.log(`Stream ${user.publicKey} ended`);
        },
    });

    return new Response(stream, {
        headers: {
            // Denotes the response as SSE
            "Content-Type": "text/event-stream",
            // Dont cache SSE
            "Cache-Control": "no-cache",
        },
    });
};

// Forward messages from redis to connected users
redisSubscribeClient.subscribe("message", (message) => {
    console.log(`Received message: ${message}`);
    // Send relevant messages to connected users
    for (const user of Object.values(connectedUsers)) {
        user.stream.enqueue(
            JSON.stringify({ type: "message", data: JSON.parse(message) }),
        );
    }
});
