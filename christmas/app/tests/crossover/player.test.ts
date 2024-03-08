import { commandSay, stream } from "$lib/crossover";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, waitForEventData } from "./utils";

test("Test Player", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = "gbsuv7";
    let [playerOneWallet, playerOneCookies] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: playerOneName,
    });

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = "gbsuv8";
    let [playerTwoWallet, playerTwoCookies] = await createRandomPlayer({
        region,
        geohash: playerTwoGeohash,
        name: playerTwoName,
    });

    // Player three
    const playerThreeName = "Sauron";
    const playerThreeGeohash = "gbsuv7";
    let [playerThreeWallet, playerThreeCookies] = await createRandomPlayer({
        region,
        geohash: playerThreeGeohash,
        name: playerThreeName,
    });

    // Stream endpoint
    const [playerOneEventStream, playerOneCloseStream] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(playerOneEventStream, "system"),
    ).resolves.toMatchObject({
        eventType: "stream",
        message: "started",
    });
    const [playerTwoEventStream, playerTwoCloseStream] = await stream({
        Cookie: playerTwoCookies,
    });
    await expect(
        waitForEventData(playerTwoEventStream, "system"),
    ).resolves.toMatchObject({
        eventType: "stream",
        message: "started",
    });
    const [playerThreeEventStream, playerThreeCloseStream] = await stream({
        Cookie: playerThreeCookies,
    });
    await expect(
        waitForEventData(playerThreeEventStream, "system"),
    ).resolves.toMatchObject({
        eventType: "stream",
        message: "started",
    });

    // Say
    await commandSay(
        { message: "Hello, world!" },
        { Cookie: playerOneCookies },
    );
    await expect(
        waitForEventData(playerOneEventStream, "message"),
    ).resolves.toMatchObject({
        eventType: "cmd",
        message: "${origin} says ${message}",
        variables: {
            origin: playerOneWallet.publicKey.toBase58(),
            cmd: "say",
            message: "Hello, world!",
        },
    });
    // Say - player three should receive message (same tile)
    await expect(
        waitForEventData(playerThreeEventStream, "message"),
    ).resolves.toMatchObject({
        eventType: "cmd",
        message: "${origin} says ${message}",
        variables: {
            origin: playerOneWallet.publicKey.toBase58(),
            cmd: "say",
            message: "Hello, world!",
        },
    });
    // Say - player two should not receive the message (different tile)
    await expect(
        waitForEventData(playerTwoEventStream, "message"),
    ).rejects.toThrowError("Timeout occurred while waiting for event");
});
