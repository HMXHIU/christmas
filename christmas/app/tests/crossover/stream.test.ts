import { stream } from "$lib/crossover";
import { expect, test } from "vitest";
import type { StreamEvent } from "../../src/routes/api/crossover/stream/+server";
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
    const eventData: StreamEvent = await waitForEventData(
        eventStream,
        "system",
    );
    expect(eventData).toMatchObject({
        type: "system",
        message: "started",
    });
});
