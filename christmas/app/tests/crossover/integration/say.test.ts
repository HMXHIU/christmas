import { crossoverCmdSay } from "$lib/crossover/client";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { saveEntities } from "$lib/server/crossover/redis/utils";
import type { PlayerEntity } from "$lib/server/crossover/types";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    generateRandomGeohash,
    waitForEventData,
} from "../utils";

let geohash: string;
let playerOne: PlayerEntity;
let playerTwo: PlayerEntity;
let playerThree: PlayerEntity;
let playerOneCookies: string;
let playerOneStream: EventTarget;
let playerThreeStream: EventTarget;
let playerTwoStream: EventTarget;

beforeAll(async () => {
    ({
        geohash,
        playerOne,
        playerTwo,
        playerThree,
        playerOneCookies,
        playerOneStream,
        playerTwoStream,
        playerThreeStream,
    } = await createGandalfSarumanSauron());

    // Test location geohash
    expect(playerOne.loc[0].length).toBe(worldSeed.spatial.unit.precision);
    expect(playerOne.loc[0].startsWith(geohash)).toBe(true);
});

beforeEach(async () => {
    geohash = generateRandomGeohash(8, "h9b");

    // playerOne and playerThree should be same location
    playerOne.loc = [geohash];
    playerThree.loc = [geohash];
    // Change playerTwo location away from playerOne & playerThree
    playerTwo.loc = [generateRandomGeohash(8, "h9r")];

    saveEntities(playerOne, playerTwo, playerThree);
});

describe("Say Integration Tests", () => {
    test("Test Appropriate Players Should Hear Say Message", async () => {
        // playerOne say
        await crossoverCmdSay(
            { message: "Hello, world!" },
            { Cookie: playerOneCookies },
        );

        // playerThree should receive message (same tile)
        await expect(
            waitForEventData(playerThreeStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                name: playerOne.name,
                cmd: "say",
                message: "Hello, world!",
            },
        });

        // playerOne should receive message (self)
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                name: playerOne.name,
                cmd: "say",
                message: "Hello, world!",
            },
        });

        // playerTwo should not receive the message (different tile)
        await expect(
            waitForEventData(playerTwoStream, "feed"),
        ).rejects.toThrowError("Timeout occurred while waiting for event");
    });
});
