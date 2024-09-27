import {
    crossoverCmdAccept,
    crossoverCmdTake,
    crossoverCmdTrade,
} from "$lib/crossover/client";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { spawnItemAtGeohash } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import { fetchEntity, saveEntity } from "$lib/server/crossover/redis/utils";
import type { ItemEntity, PlayerEntity } from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { CTAEvent } from "../../../src/routes/api/crossover/stream/+server";
import {
    createGandalfSarumanSauron,
    resetEntityResources,
    waitForEventData,
} from "../utils";

await initializeClients(); // create redis repositories

let {
    geohash,
    playerOne,
    playerOneCookies,
    playerOneStream,
    playerTwo,
    playerTwoCookies,
    playerTwoStream,
} = await createGandalfSarumanSauron();

let woodenclub = (await spawnItemAtGeohash({
    geohash,
    locationType: "geohash",
    locationInstance: LOCATION_INSTANCE,
    prop: compendium.woodenclub.prop,
})) as ItemEntity;

beforeAll(async () => {
    // `playerTwo` take `woodenClub`
    await crossoverCmdTake(
        { item: woodenclub.item },
        { Cookie: playerTwoCookies },
    );
    await sleep(MS_PER_TICK * actions.take.ticks);
    woodenclub = (await fetchEntity(woodenclub.item)) as ItemEntity;
    expect(woodenclub.loc[0]).toBe(playerTwo.player);
});

beforeEach(async () => {
    await resetEntityResources(playerOne, playerTwo);

    // Put woodenclub in `playerTwo` inventory
    woodenclub.loc[0] = playerTwo.player;
    woodenclub.locI = playerTwo.locI;
    woodenclub.locT = "inv";
    woodenclub = await saveEntity(woodenclub);
});

describe("Trade Tests", () => {
    test("Trade with player", async () => {
        /**
         * Buy CTA
         */

        // `playerOne` wants to buy `playerTwo`s `woodenClub` for 100 lum
        crossoverCmdTrade(
            {
                buyer: playerOne.player,
                seller: playerTwo.player,
                offer: {
                    currency: {
                        lum: 100,
                    },
                },
                receive: {
                    items: [woodenclub.item],
                },
            },
            { Cookie: playerOneCookies },
        );

        // Check CTA event (on seller which is `playerTwo`)
        var cta = (await waitForEventData(playerTwoStream, "cta")) as CTAEvent;
        expect(
            cta.cta.message.startsWith(
                `${playerOne.name} is offering to buy Wooden Club for 100 lum. You have 60s to`,
            ),
        ).toBeTruthy();
        expect(cta.cta.token).toBeTruthy();
        expect(cta.cta.pin).toBeTruthy();

        await sleep(MS_PER_TICK * actions.trade.ticks * 2);

        // Trader `accept` the CTA
        crossoverCmdAccept(
            { token: cta.cta.token },
            { Cookie: playerTwoCookies },
        );

        // Check `playerTwo` got message that `playerOne` does not have enough currencies
        await expect(
            waitForEventData(playerTwoStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: `${playerOne.name} does not have 100 lum.`,
            event: "feed",
        });
        await sleep(MS_PER_TICK * actions.trade.ticks * 2);

        // Give `playerOne` enough currency to complete the trade
        playerOne.lum = 1000;
        playerOne = await saveEntity(playerOne);

        // Trader `accept` the CTA
        crossoverCmdAccept(
            { token: cta.cta.token },
            { Cookie: playerTwoCookies },
        );

        // Check `playerOne` and `playerTwo` got successful trade dialogues
        var playerOneFeed = null;
        var playerTwoFeed = null;
        waitForEventData(playerTwoStream, "feed").then(
            (e) => (playerTwoFeed = e),
        );
        waitForEventData(playerOneStream, "feed").then(
            (e) => (playerOneFeed = e),
        );
        await sleep(MS_PER_TICK * actions.trade.ticks * 2);
        expect(playerTwoFeed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: `${playerOne.name}`,
                message: `${playerOne.name} hands you 100 lum, 'Pleasure doing business with you, ${playerTwo.name}'`,
            },
            event: "feed",
        });
        expect(playerOneFeed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: playerTwo.player,
                name: `${playerTwo.name}`,
                message: `${playerTwo.name} hands you Wooden Club, 'Pleasure doing business with you, ${playerOne.name}'`,
            },
            event: "feed",
        });

        // Check players have the traded items
        woodenclub = (await fetchEntity(woodenclub.item)) as ItemEntity;
        expect(woodenclub.loc[0]).toBe(playerOne.player);
        const playerOneAfter = (await fetchEntity(
            playerOne.player,
        )) as PlayerEntity;
        expect(playerOne.lum - playerOneAfter.lum).toBe(100);
        const playerTwoAfter = (await fetchEntity(
            playerTwo.player,
        )) as PlayerEntity;
        expect(playerTwoAfter.lum - playerTwo.lum).toBe(100);

        /**
         * Sell CTA
         */

        // `playerOne` wants to sell `playerTwo` a `woodenClub` for 100 lum
        crossoverCmdTrade(
            {
                seller: playerOne.player,
                buyer: playerTwo.player,
                receive: {
                    items: [woodenclub.item],
                },
                offer: {
                    currency: {
                        lum: 100,
                    },
                },
            },
            { Cookie: playerOneCookies },
        );

        // Check CTA event (on buyer which is `playerTwo`)
        var cta = (await waitForEventData(playerTwoStream, "cta")) as CTAEvent;
        expect(
            cta.cta.message.startsWith(
                `${playerOne.name} is offering to sell Wooden Club for 100 lum`,
            ),
        ).toBeTruthy();
        expect(cta.cta.token).toBeTruthy();
        expect(cta.cta.pin).toBeTruthy();

        await sleep(MS_PER_TICK * actions.trade.ticks * 2);

        // Trader `accept` the CTA
        crossoverCmdAccept(
            { token: cta.cta.token },
            { Cookie: playerTwoCookies },
        );

        // Check `playerOne` and `playerTwo` got successful trade dialogues
        var playerOneFeed = null;
        var playerTwoFeed = null;
        waitForEventData(playerOneStream, "feed").then(
            (e) => (playerOneFeed = e),
        );
        waitForEventData(playerTwoStream, "feed").then(
            (e) => (playerTwoFeed = e),
        );
        await sleep(MS_PER_TICK * actions.trade.ticks * 2);

        expect(playerOneFeed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: playerTwo.player,
                name: `${playerTwo.name}`,
                message: `${playerTwo.name} hands you 100 lum, 'Pleasure doing business with you, ${playerOne.name}'`,
            },
            event: "feed",
        });

        expect(playerTwoFeed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: `${playerOne.name}`,
                message: `${playerOne.name} hands you Wooden Club, 'Pleasure doing business with you, ${playerTwo.name}'`,
            },
            event: "feed",
        });

        await sleep(MS_PER_TICK * actions.trade.ticks * 2);
    });
});
