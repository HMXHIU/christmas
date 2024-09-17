import { crossoverCmdLook } from "$lib/crossover/client";
import { minifiedEntity } from "$lib/crossover/utils";
import { initializeClients, saveEntity } from "$lib/server/crossover/redis";
import { omit } from "lodash-es";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    generateRandomGeohash,
    waitForEventData,
} from "../utils";

await initializeClients();

let {
    geohash,
    playerOne,
    playerTwo,
    playerThree,
    playerOneCookies,
    playerOneStream,
} = await createGandalfSarumanSauron();

beforeAll(async () => {});

beforeEach(async () => {
    geohash = generateRandomGeohash(8, "h9b");

    // playerOne and playerThree should be same location
    playerOne.loc = [geohash];
    playerOne = await saveEntity(playerOne);

    playerThree.loc = [geohash];
    playerThree = await saveEntity(playerThree);

    // Change playerTwo location away from playerOne & playerThree
    playerTwo.loc = [generateRandomGeohash(8, "h9r")];
    playerTwo = await saveEntity(playerTwo);
});

describe("Look Tests", () => {
    test("Test Look", async () => {
        // playerOne look
        await crossoverCmdLook({}, { Cookie: playerOneCookies });

        // playerOne should not see playerTwo
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            players: [
                omit(playerOne, "buclk"), // self should be full entity
                minifiedEntity(playerThree), // others are minified
            ],
            op: "replace",
        });
    });
});
