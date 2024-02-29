import { SaySchema } from "$lib/crossover/schemas";
import { redisClient } from "$lib/server/crossover/redis";
import type { z } from "zod";

export { processCommandSay };

function processCommandSay(
    user: App.UserSession,
    data: z.infer<typeof SaySchema>,
) {
    const said = `${user.publicKey} said: ${data.message}!`;

    // Get user's tile

    // Get all users in the tile

    // Send message to all users in the tile
    redisClient.publish(
        "message",
        JSON.stringify({
            origin: user.publicKey,
            cmd: "say",
            data,
        }),
    );
}
