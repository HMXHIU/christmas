import { crossoverCmdMove } from "$lib/crossover/client";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { fetchEntity, saveEntities } from "$lib/server/crossover/redis/utils";
import type { PlayerEntity } from "$lib/server/crossover/types";
import ngeohash from "ngeohash";
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

beforeAll(async () => {
    ({
        geohash,
        playerOne,
        playerTwo,
        playerThree,
        playerOneCookies,
        playerOneStream,
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

describe("Move Integration Tests", () => {
    test("Test Players Receive Each Other's Movement", async () => {
        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        const north = ngeohash.neighbor(playerOne.loc[0], [1, 0]);

        // playerOne move north
        await crossoverCmdMove({ path: ["n"] }, { Cookie: playerOneCookies });

        // playerOne & playerThree should be informed of playerOne new location
        await expect(
            waitForEventData(playerThreeStream, "entities"),
        ).resolves.toMatchObject({
            players: [
                {
                    player: playerOne.player,
                    loc: [north],
                },
            ],
            op: "upsert",
            event: "entities",
        });
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            players: [
                {
                    player: playerOne.player,
                    loc: [north],
                },
            ],
            op: "upsert",
            event: "entities",
        });
    });
});
