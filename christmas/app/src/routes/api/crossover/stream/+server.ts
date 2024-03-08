import { requireLogin } from "$lib/server";
import { connectedUsers } from "$lib/server/crossover";
import { redisSubscribeClient } from "$lib/server/crossover/redis";
import type { RequestHandler } from "./$types";

export interface StreamEvent {
    streamType: "message" | "system";
    data: StreamEventData;
}

export type StreamEventData = SystemEventData | MessageEventData;

export interface SystemEventData {
    eventType: "stream";
    message: string;
}

export interface MessageEventData {
    eventType: "cmd";
    message: string;
    variables: Record<string, string | number | boolean>;
}

function onMessage(message: string, channel: string) {
    const messageData: MessageEventData = JSON.parse(message);
    const streamData: StreamEvent = {
        streamType: "message",
        data: messageData,
    };

    try {
        connectedUsers[channel].controller.enqueue(
            JSON.stringify(streamData) + "\n\n", // SSE messages are separated by two newlines
        );
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

            // Send start event
            const streamData: StreamEvent = {
                streamType: "system",
                data: {
                    eventType: "stream",
                    message: "started",
                },
            };
            controller.enqueue(JSON.stringify(streamData) + "\n\n");
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
