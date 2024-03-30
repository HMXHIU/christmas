import { commandPerformAbility, stream } from "$lib/crossover";
import { abilities } from "$lib/crossover/world/abilities";
import { expect, test } from "vitest";
import { createRandomPlayer, waitForEventData } from "./utils";

test("Test Stream", async () => {
    // Create players
    const region = "SGP";
    const geohash = "gbsuv7bp";

    const [playerOneWallet, playerOneCookie, playerOne] =
        await createRandomPlayer({
            region,
            geohash,
            name: "player",
        });

    const [playerTwoWallet, playerTwoCookie, playerTwo] =
        await createRandomPlayer({
            region,
            geohash,
            name: "player",
        });

    // Create streams
    const [eventStreamOne, closeStreamOne] = await stream({
        Cookie: playerOneCookie,
    });
    await expect(
        waitForEventData(eventStreamOne, "system"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    const [eventStreamTwo, closeStreamTwo] = await stream({
        Cookie: playerTwoCookie,
    });
    await expect(
        waitForEventData(eventStreamTwo, "system"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // `playerOne` attacks player `playerTwo`
    setTimeout(async () => {
        await commandPerformAbility(
            {
                ability: abilities.scratch.ability,
                target: playerTwo.player,
            },
            { Cookie: playerOneCookie },
        );
    }, 0);
    await expect(
        waitForEventData(eventStreamTwo, "message"),
    ).resolves.toMatchObject({
        type: "message",
        message: "You took 1 damage",
        variables: {},
    });

    // `playerTwo` heals itself
    setTimeout(async () => {
        await commandPerformAbility(
            {
                ability: abilities.bandage.ability,
                target: playerTwo.player,
            },
            { Cookie: playerTwoCookie },
        );
    }, 0);
    await expect(
        waitForEventData(eventStreamTwo, "message"),
    ).resolves.toMatchObject({
        type: "message",
        message: "You healed for 5",
        variables: {},
    });
});
