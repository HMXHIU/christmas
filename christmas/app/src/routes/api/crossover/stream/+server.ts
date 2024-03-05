import { requireLogin } from "$lib/server";
import { connectedUsers } from "$lib/server/crossover";
import { redisSubscribeClient } from "$lib/server/crossover/redis";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = (event) => {
    const user = requireLogin(event);

    function onMessage(message: string) {
        console.log(
            "Received message: " + message,
            connectedUsers[user.publicKey].stream,
        );
        connectedUsers[user.publicKey].stream.enqueue(
            JSON.stringify({ type: "message", data: JSON.parse(message) }) +
                "\n\n", // SSE messages are separated by two newlines
        );
    }

    // Create a register user stream on this server instance
    const stream = new ReadableStream({
        start(controller) {
            connectedUsers[user.publicKey] = {
                stream: controller,
                publicKey: user.publicKey,
            };

            redisSubscribeClient.subscribe(user.publicKey, onMessage);
            console.log(`Stream ${user.publicKey} started`);
        },
        cancel() {
            redisSubscribeClient.unsubscribe(user.publicKey, onMessage);
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
