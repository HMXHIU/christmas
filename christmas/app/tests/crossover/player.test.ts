import { commandLook, commandMove, commandSay, stream } from "$lib/crossover";
import { worldSeed } from "$lib/crossover/world";
import { playerStats } from "$lib/crossover/world/player";
import { groupBy } from "lodash";
import ngeohash from "ngeohash";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, waitForEventData } from "./utils";

test("Test Player", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = "gbsuv7";
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });
    expect(playerOne.geohash.length).toBe(worldSeed.spatial.unit.precision);
    expect(playerOne.geohash.startsWith(playerOneGeohash)).toBe(true);

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = "gbsuv8";
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });
    expect(playerTwo.geohash.length).toBe(worldSeed.spatial.unit.precision);
    expect(playerTwo.geohash.startsWith(playerTwoGeohash)).toBe(true);

    // Player three
    const playerThreeName = "Sauron";
    const playerThreeGeohash = "gbsuv7";
    let [playerThreeWallet, playerThreeCookies, playerThree] =
        await createRandomPlayer({
            region,
            geohash: playerThreeGeohash,
            name: playerThreeName,
        });
    expect(playerThree.geohash.length).toBe(worldSeed.spatial.unit.precision);
    expect(playerThree.geohash.startsWith(playerThreeGeohash)).toBe(true);

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

    // Look - no target (tile)
    let lookAtResult = await commandLook({}, { Cookie: playerOneCookies });
    expect(lookAtResult.tile).toMatchObject({
        geohash: playerOne.geohash,
    });
    expect(groupBy(lookAtResult.players, "player")).contains.keys([
        playerOneWallet.publicKey.toBase58(),
        playerThreeWallet.publicKey.toBase58(),
    ]);

    // Move
    const nextTile = await commandMove(
        { direction: "n" },
        { Cookie: playerOneCookies },
    );
    const northTile = ngeohash.neighbor(playerOne.geohash, [1, 0]);
    expect(nextTile).toEqual(northTile);

    // Stats
    expect(playerStats({ level: 1 })).toMatchObject({
        hp: 10,
        mp: 10,
        st: 10,
        ap: 10,
    });
    expect(playerStats({ level: 2 })).toMatchObject({
        hp: 20,
        mp: 20,
        st: 20,
        ap: 20,
    });
});
