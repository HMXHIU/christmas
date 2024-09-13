import { crossoverCmdAccept, crossoverCmdLearn } from "$lib/crossover/client";
import { actions } from "$lib/crossover/world/actions";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { skillLevelProgression } from "$lib/crossover/world/skills";
import { spawnItem } from "$lib/server/crossover/dungeonMaster";
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
import { beforeAll, describe, expect, test } from "vitest";
import type { CTAEvent } from "../../src/routes/api/crossover/stream/+server";
import {
    createGandalfSarumanSauron,
    generateRandomGeohash,
    waitForEventData,
} from "./utils";

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
    woodenclub = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;
});

describe("CTA Tests", () => {
    test("`trade` with human player", async () => {});
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
                message: "${teacher.name} hands you a worn map and a compass.",
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
