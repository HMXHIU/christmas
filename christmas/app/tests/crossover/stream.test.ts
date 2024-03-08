import { stream } from "$lib/crossover";
import { expect, test } from "vitest";
import type { StreamEventData } from "../../src/routes/api/crossover/stream/+server";
import { createRandomPlayer, waitForEventData } from "./utils";

test("Test Stream", async () => {
    // Create a player
    const region = "SGP";
    const geohash = "gbsuv7";
    const [playerWallet, playerCookie] = await createRandomPlayer({
        region,
        geohash,
        name: "player",
    });

    // Stream endpoint
    const [eventStream, closeStream] = await stream({ Cookie: playerCookie });
    const eventData: StreamEventData = await waitForEventData(
        eventStream,
        "system",
    );
    expect(eventData).toMatchObject({
        eventType: "stream",
        message: "started",
    });
});
