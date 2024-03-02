import { stream } from "$lib/crossover";
import { expect, test } from "vitest";
import { createRandomPlayer, waitForEventData } from "./utils";

test("Test Stream", async () => {
    // Create a player
    const playerRegion = "SGP";
    const [playerWallet, playerCookie] = await createRandomPlayer({
        region: playerRegion,
        name: "player",
    });

    // Stream endpoint
    const eventStream = await stream({ Cookie: playerCookie });
    const eventData = await waitForEventData(eventStream, "system");

    expect(eventData).toMatchObject({
        event: "stream",
        message: "started",
    });
});
