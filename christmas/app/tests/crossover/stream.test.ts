import { crossoverCmdPerformAbility, stream } from "$lib/crossover";
import { abilities } from "$lib/crossover/world/settings";
import { expect, test, vi } from "vitest";
import { createRandomPlayer, waitForEventData } from "./utils";

vi.mock("$lib/crossover/world", async (module) => {
    return { ...((await module()) as object), MS_PER_TICK: 10 };
});

test("Test Stream", async () => {
    // Create players
    const region = "SGP";
    const geohash = "gbsuv7bp";

    // Create players
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
        waitForEventData(eventStreamOne, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    const [eventStreamTwo, closeStreamTwo] = await stream({
        Cookie: playerTwoCookie,
    });
    await expect(
        waitForEventData(eventStreamTwo, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    /*
     * `playerOne` scratch `playerTwo`
     */

    setTimeout(async () => {
        await crossoverCmdPerformAbility(
            {
                ability: abilities.scratch.ability,
                target: playerTwo.player,
            },
            { Cookie: playerOneCookie },
        );
    }, 0);

    // Check `playerOne` received `entities` event updating resources (ap, st)
    await expect(
        waitForEventData(eventStreamOne, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                st: 9, // -1
                ap: 9, // -1
            },
        ],
        monsters: [],
        items: [],
    });

    // Check `playerTwo` received `entities` event which includes `playerOne`'s updated state
    await expect(
        waitForEventData(eventStreamTwo, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerTwo.player,
                hp: 9, // -1 hp
            },
            {
                player: playerOne.player,
                st: 9,
                ap: 9,
            },
        ],
        monsters: [],
        items: [],
    });

    /*
     * `playerTwo` bandage itself
     */

    setTimeout(async () => {
        await crossoverCmdPerformAbility(
            {
                ability: abilities.bandage.ability,
                target: playerTwo.player,
            },
            { Cookie: playerTwoCookie },
        );
    }, 0);

    // Check `playerTwo` received `entities` event updating resources (ap, st)
    await expect(
        waitForEventData(eventStreamTwo, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerTwo.player,
                hp: 9,
                st: 9, // -1
                ap: 8, // -2
                debuffs: [],
                buffs: [],
            },
        ],
        monsters: [],
        items: [],
    });

    // Check `playerTwo` received `entities` event updating effect
    await expect(
        waitForEventData(eventStreamTwo, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [
            {
                player: playerTwo.player,
                hp: 14, // +5 hp
                st: 9, // -1
                ap: 8, // -2
                debuffs: [],
                buffs: [],
            },
        ],
        monsters: [],
        items: [],
    });
});
