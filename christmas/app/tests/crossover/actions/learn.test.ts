import { crossoverCmdAccept, crossoverCmdLearn } from "$lib/crossover/client";
import { actions } from "$lib/crossover/world/actions";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { skillLevelProgression } from "$lib/crossover/world/skills";
import { spawnMonster } from "$lib/server/crossover/dungeonMaster";
import { generateNPC } from "$lib/server/crossover/npc";
import {
    fetchEntity,
    initializeClients,
    saveEntity,
} from "$lib/server/crossover/redis";
import type {
    Monster,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { npcs } from "$lib/server/crossover/settings/npc";
import { sleep } from "$lib/utils";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { CTAEvent } from "../../../src/routes/api/crossover/stream/+server";
import {
    createGandalfSarumanSauron,
    generateRandomGeohash,
    waitForEventData,
} from "../utils";

let region: string;
let geohash: string;

let playerOne: Player;
let playerOneCookies: string;
let playerOneStream: EventTarget;
let playerTwo: Player;
let playerTwoCookies: string;
let playerTwoStream: EventTarget;
let playerThree: Player;
let playerThreeCookies: string;
let playerThreeStream: EventTarget;

let dragon: Monster;
let goblin: Monster;

// NPC
let npc: Player;

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
        playerThree,
        playerThreeCookies,
        playerThreeStream,
    } = await createGandalfSarumanSauron());

    // Spawn Monsters
    dragon = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        beast: "dragon",
        locationInstance: LOCATION_INSTANCE,
    });

    goblin = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        beast: "goblin",
        locationInstance: LOCATION_INSTANCE,
    });

    // Spawn NPCs
    npc = await generateNPC(npcs.blacksmith.npc, {
        demographic: {},
        appearance: {},
    });
});

beforeEach(async () => {
    playerOne.lum = 0;
    playerOne = (await saveEntity(playerOne as PlayerEntity)) as PlayerEntity;
    playerTwo.lum = 0;
    playerTwo = (await saveEntity(playerTwo as PlayerEntity)) as PlayerEntity;
});

describe("Learn Tests", () => {
    test("Learn skill from human player", async () => {
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
        npc.loc = playerOne.loc;
        npc.locI = playerOne.locI;
        npc.locT = playerOne.locT;
        npc = (await saveEntity(npc as PlayerEntity)) as PlayerEntity;

        // Test teacher not enough skill
        crossoverCmdLearn(
            { skill: "exploration", teacher: npc.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: npc.player,
                name: "Blacksmith",
                message:
                    "Blacksmith furrows his brow. 'This skill lies beyond even my grasp. Seek out one more learned than I.'",
            },
            event: "feed",
        });

        // Test player not enough learning resources
        npc.skills["exploration"] = 10;
        npc = (await saveEntity(npc as PlayerEntity)) as PlayerEntity;
        crossoverCmdLearn(
            { skill: "exploration", teacher: npc.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: npc.player,
                name: "Blacksmith",
                message:
                    "Despite your best efforts, the skill eludes you, perhaps with more experience.",
            },
            event: "feed",
        });

        // Test able to learn
        playerOne.lum = 1000;
        playerOne = (await saveEntity(
            playerOne as PlayerEntity,
        )) as PlayerEntity;
        const curSkillLevel = playerOne.skills?.exploration ?? 0;
        crossoverCmdLearn(
            { skill: "exploration", teacher: npc.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: npc.player,
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
