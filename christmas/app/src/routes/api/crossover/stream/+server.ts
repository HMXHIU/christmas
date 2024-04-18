import { requireLogin } from "$lib/server";
import { connectedUsers } from "$lib/server/crossover";
import { redisSubscribeClient } from "$lib/server/crossover/redis";
import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import type { RequestHandler } from "./$types";

export type StreamEvent = FeedEvent | UpdateEntitiesEvent;

export interface FeedEvent {
    event: "feed";
    type: "message" | "system" | "error";
    message: string;
    variables?: Record<string, string | number | boolean>;
}

export interface UpdateEntitiesEvent {
    event: "entities";
    players?: Player[];
    monsters?: Monster[];
    items?: Item[];
}

function sendStreamEvent(
    controller: ReadableStreamDefaultController<any>,
    event: StreamEvent,
) {
    controller.enqueue(JSON.stringify(event) + "\n\n");
}

function onMessage(message: string, channel: string) {
    // `message` is a JSON stringified StreamEvent
    try {
        connectedUsers[channel].controller.enqueue(message + "\n\n");
    } catch (error: any) {
        console.error(error.message);
    }
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

            // Send system feed started event
            sendStreamEvent(controller, {
                event: "feed",
                type: "system",
                message: "started",
            });
            console.log(`Stream ${user.publicKey} started`);
        },
        cancel() {
            redisSubscribeClient.unsubscribe(user.publicKey);
            delete connectedUsers[user.publicKey];
            console.log(`Stream ${user.publicKey} stopped`);
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
