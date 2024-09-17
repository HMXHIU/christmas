import { crossoverCmdAccept, crossoverCmdLearn } from "$lib/crossover/client";
import { actions } from "$lib/crossover/world/actions";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { skillLevelProgression } from "$lib/crossover/world/skills";
import {
    fetchEntity,
    initializeClients,
    saveEntity,
} from "$lib/server/crossover/redis";
import type { PlayerEntity } from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import { beforeEach, describe, expect, test } from "vitest";
import type { CTAEvent } from "../../../src/routes/api/crossover/stream/+server";
import {
    createGandalfSarumanSauron,
    createNPCs,
    resetPlayerResources,
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
let { blackSmith } = await createNPCs({
    geohash,
    locationInstance: LOCATION_INSTANCE,
});

beforeEach(async () => {
    resetPlayerResources(playerOne, playerTwo);
});

describe("Learn Tests", () => {
    test("Learn skill from human player", async () => {
        // Increase `playerTwo` skills and `playerOne` resources
        playerTwo.skills["exploration"] = 10;
        playerTwo = await saveEntity(playerTwo);
        playerOne.lum = 1000;
        playerOne = await saveEntity(playerOne);

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
                name: "Writ of Learning",
            },
            event: "cta",
        });
        expect(
            cta.cta.description.startsWith(
                "Gandalf requests to learn exploration from you.",
            ),
        );
        expect(cta.cta.token).toBeTruthy();
        expect(cta.cta.pin).toBeTruthy();

        await sleep(MS_PER_TICK * actions.learn.ticks);

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
            lum: playerOne.lum - skillLevelProgression(curSkillLevel + 1),
        });
    });

    test("Learn from NPC", async () => {
        blackSmith.loc = playerOne.loc;
        blackSmith.locI = playerOne.locI;
        blackSmith.locT = playerOne.locT;
        blackSmith = await saveEntity(blackSmith);

        // Test teacher not enough skill
        crossoverCmdLearn(
            { skill: "exploration", teacher: blackSmith.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: blackSmith.player,
                name: "Blacksmith",
                message:
                    "Blacksmith furrows his brow. 'This skill lies beyond even my grasp. Seek out one more learned than I.'",
            },
            event: "feed",
        });

        // Test player not enough learning resources
        blackSmith.skills["exploration"] = 10;
        blackSmith = await saveEntity(blackSmith);
        crossoverCmdLearn(
            { skill: "exploration", teacher: blackSmith.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: blackSmith.player,
                name: "Blacksmith",
                message:
                    "Despite your best efforts, the skill eludes you, perhaps with more experience.",
            },
            event: "feed",
        });

        // Test able to learn
        playerOne.lum = 1000;
        playerOne = await saveEntity(playerOne);
        const curSkillLevel = playerOne.skills?.exploration ?? 0;
        crossoverCmdLearn(
            { skill: "exploration", teacher: blackSmith.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: blackSmith.player,
                name: "Blacksmith",
                message: "Blacksmith hands you a worn map and a compass.",
            },
            event: "feed",
        });
        await sleep(actions.learn.ticks * MS_PER_TICK * 2);

        // Check skill level and resources
        const playerOneAfter = (await fetchEntity(
            playerOne.player,
        )) as PlayerEntity;
        expect(playerOneAfter).toMatchObject({
            skills: {
                exploration: curSkillLevel + 1,
            },
            lum: playerOne.lum - skillLevelProgression(curSkillLevel + 1),
        });
    });
});
