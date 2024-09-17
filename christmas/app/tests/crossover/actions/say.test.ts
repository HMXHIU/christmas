import { crossoverCmdSay } from "$lib/crossover/client";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { spawnMonster } from "$lib/server/crossover/dungeonMaster";
import { generateNPC } from "$lib/server/crossover/npc";
import { initializeClients } from "$lib/server/crossover/redis";
import type { Monster, Player } from "$lib/server/crossover/redis/entities";
import { npcs } from "$lib/server/crossover/settings/npc";
import { sleep } from "$lib/utils";
import { beforeAll, describe, expect, test } from "vitest";
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

describe("Say Tests", () => {
    test("Say to specific `target`", async () => {
        // `playerOne` says hello to `playerTwo`
        crossoverCmdSay(
            { message: "hello", target: playerTwo.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerTwoStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: playerOne.name,
                message: "hello",
            },
            event: "feed",
        });
        await sleep(MS_PER_TICK * 2);

        // `playerOne` says hello to `playerTwo`, `playerThree` should not get message
        crossoverCmdSay(
            { message: "hello", target: playerTwo.player },
            { Cookie: playerOneCookies },
        );
        await expect(
            waitForEventData(playerThreeStream, "feed"),
        ).rejects.toThrowError("Timeout occurred while waiting for event");
        await sleep(MS_PER_TICK * 2);
    });

    test("Say to everyone", async () => {
        // `playerOne` says to everyone
        crossoverCmdSay({ message: "hello" }, { Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerTwoStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: playerOne.name,
                message: "hello",
            },
            event: "feed",
        });
        await expect(
            waitForEventData(playerThreeStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: playerOne.name,
                message: "hello",
            },
            event: "feed",
        });
    });
});
