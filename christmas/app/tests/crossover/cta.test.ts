import {
    crossoverCmdAccept,
    crossoverCmdLearn,
    crossoverCmdTake,
    crossoverCmdTrade,
} from "$lib/crossover/client";
import { actions } from "$lib/crossover/world/actions";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { skillLevelProgression } from "$lib/crossover/world/skills";
import { spawnItemAtGeohash } from "$lib/server/crossover/dungeonMaster";
import {
    fetchEntity,
    initializeClients,
    saveEntity,
} from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { CTAEvent } from "../../src/routes/api/crossover/stream/+server";
import { createGandalfSarumanSauron, waitForEventData } from "./utils";

let region: string;
let geohash: string;

let playerOne: Player;
let playerOneCookies: string;
let playerOneStream: EventTarget;
let playerTwo: Player;
let playerTwoCookies: string;
let playerTwoStream: EventTarget;

let woodenclub: Item;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Create players
    ({
        region,
        geohash,
        playerOne,
        playerOneCookies,
        playerOneStream,
        playerTwo,
        playerTwoCookies,
        playerTwoStream,
    } = await createGandalfSarumanSauron());

    // Spawn items
    woodenclub = (await spawnItemAtGeohash({
        geohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;
});

beforeEach(async () => {
    playerOne.lum = 0;
    playerOne = (await saveEntity(playerOne as PlayerEntity)) as PlayerEntity;
});

describe("CTA Tests", () => {
    test("`trade` with human player", async () => {
        // `playerTwo` take `woodenClub`
        await crossoverCmdTake(
            { item: woodenclub.item },
            { Cookie: playerTwoCookies },
        );
        await sleep(MS_PER_TICK * actions.take.ticks);
        woodenclub = (await fetchEntity(woodenclub.item)) as ItemEntity;
        expect(woodenclub.loc[0]).toBe(playerTwo.player);

        // `playerOne` trade 100 lumina for `playerTwo`s `woodenClub`
        crossoverCmdTrade(
            {
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

        // Check CTA event (on trader which is `playerTwo`)
        var cta = (await waitForEventData(playerTwoStream, "cta")) as CTAEvent;
        expect(cta).toMatchObject({
            cta: {
                cta: "writ",
                name: "Trade Writ",
            },
            event: "cta",
        });
        expect(
            cta.cta.description.startsWith(
                `${playerOne.name} is offering to buy 100 lum for Wooden Club. You have 60s to`,
            ),
        ).toBeTruthy();
        expect(cta.cta.token).toBeTruthy();
        expect(cta.cta.pin).toBeTruthy();

        // Trader `accept` the CTA
        crossoverCmdAccept(
            { token: cta.cta.token },
            { Cookie: playerTwoCookies },
        );

        // Check `playerTwo` got message that `playerOne` does not have enough currencies
        var feed = await waitForEventData(playerTwoStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: playerOne.name,
                message: `${playerOne.name} does not have the items or currencies needed to barter.`,
            },
            event: "feed",
        });

        // Give `playerOne` enough currency to complete the trade
        playerOne.lum = 1000;
        playerOne = (await saveEntity(
            playerOne as PlayerEntity,
        )) as PlayerEntity;

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
        await sleep(MS_PER_TICK * actions.accept.ticks);
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
        await sleep(MS_PER_TICK * actions.trade.ticks * 2);

        // Check players have the traded items
        woodenclub = (await fetchEntity(woodenclub.item)) as ItemEntity;
        expect(woodenclub.loc[0]).toBe(playerOne.player);
        const playerOneAfter = (await fetchEntity(
            playerOne.player,
        )) as PlayerEntity;
        expect(playerOneAfter.lum).toBe(playerOne.lum - 100);
    });
    test("`learn` from human player", async () => {
        // Increase `playerTwo` skills and `playerOne` resources
        playerTwo.skills["exploration"] = 10;
        playerTwo = (await saveEntity(
            playerTwo as PlayerEntity,
        )) as PlayerEntity;
        playerOne.lum = 1000;
        playerOne = (await saveEntity(
            playerOne as PlayerEntity,
        )) as PlayerEntity;

        // `playerOne` learn `exploration` from playerTwo
        crossoverCmdLearn(
            {
                skill: "exploration",
                teacher: playerTwo.player,
            },
            { Cookie: playerOneCookies },
        );

        // Check CTA event (on teacher which is `playerTwo`)
        var cta = (await waitForEventData(playerTwoStream, "cta")) as CTAEvent;
        expect(cta).toMatchObject({
            cta: {
                cta: "writ",
                name: "Writ of Learning",
                description:
                    "This writ allows you to learn exploration from Saruman.",
            },
            event: "cta",
        });
        expect(cta.cta.token).toBeTruthy();
        expect(cta.cta.pin).toBeTruthy();

        // Teacher `accept` the CTA
        crossoverCmdAccept(
            { token: cta.cta.token },
            { Cookie: playerTwoCookies },
        );

        // Check `playerOne` starts learning
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: playerTwo.player,
                name: playerTwo.name,
                message: `${playerTwo.name} hands you a worn map and a compass.`,
            },
            event: "feed",
        });
        await sleep(MS_PER_TICK * actions.learn.ticks);

        // Check `playerOne` has learnt skill
        const curSkillLevel = playerOne.skills?.exploration ?? 0;
        const playerOneAfter = (await fetchEntity(
            playerOne.player,
        )) as PlayerEntity;
        expect(playerOneAfter).toMatchObject({
            skills: {
                exploration: curSkillLevel + 1,
            },
            lum: playerOne.lum - skillLevelProgression(curSkillLevel),
        });
    });
});
