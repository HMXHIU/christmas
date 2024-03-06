import { requireLogin } from "$lib/server";
import { connectedUsers } from "$lib/server/crossover";
import { redisSubscribeClient } from "$lib/server/crossover/redis";
import type { RequestHandler } from "./$types";

function onMessage(message: string, channel: string) {
    connectedUsers[channel].controller.enqueue(
        JSON.stringify({ type: "message", data: JSON.parse(message) }) + "\n\n", // SSE messages are separated by two newlines
    );
}

export const GET: RequestHandler = async (event) => {
    const user = requireLogin(event);

    // Unsubscribe from any previous streams
    await redisSubscribeClient.unsubscribe(user.publicKey);
    connectedUsers[user.publicKey]?.controller?.close();

    // Create a register user stream on this server instance
    const stream = new ReadableStream({
        start(controller) {
            connectedUsers[user.publicKey] = {
                controller,
                publicKey: user.publicKey,
            };
            redisSubscribeClient.subscribe(user.publicKey, onMessage);
            console.log(`Stream ${user.publicKey} started`);
        },
        cancel() {
            redisSubscribeClient.unsubscribe(user.publicKey);
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
