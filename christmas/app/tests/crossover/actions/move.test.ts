import { crossoverCmdMove } from "$lib/crossover/client";
import { aStarPathfinding } from "$lib/crossover/pathfinding";
import {
    geohashNeighbour,
    getGeohashesForPath,
    getPositionsForPath,
    isEntityInMotion,
} from "$lib/crossover/utils";
import { biomeAtGeohash, biomes } from "$lib/crossover/world/biomes";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type { Direction } from "$lib/crossover/world/types";
import { move } from "$lib/server/crossover/actions";
import { spawnItemAtGeohash } from "$lib/server/crossover/dungeonMaster";
import {
    fetchEntity,
    initializeClients,
    saveEntity,
} from "$lib/server/crossover/redis";
import type {
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import type NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { cloneDeep } from "lodash";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
    collectEventDataForDuration,
    createGandalfSarumanSauron,
    flushEventChannel,
    generateRandomGeohash,
    waitForEventData,
} from "../utils";

let region: string;
let geohash: string;
let playerOne: PlayerEntity;
let playerTwo: PlayerEntity;
let playerThree: PlayerEntity;
let playerOneCookies: string;
let playerTwoCookies: string;
let playerThreeCookies: string;
let playerOneStream: EventTarget;
let playerTwoStream: EventTarget;
let playerThreeStream: EventTarget;
let playerOneWallet: NodeWallet;
let playerTwoWallet: NodeWallet;
let playerThreeWallet: NodeWallet;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    ({
        region,
        geohash,
        playerOne,
        playerTwo,
        playerThree,
        playerOneCookies,
        playerTwoCookies,
        playerThreeCookies,
        playerOneStream,
        playerTwoStream,
        playerThreeStream,
        playerOneWallet,
        playerTwoWallet,
        playerThreeWallet,
    } = await createGandalfSarumanSauron());
});

beforeEach(async () => {
    geohash = generateRandomGeohash(8, "h9b");

    // Reset playerOne location
    playerOne.loc = [geohash];
    playerOne = (await saveEntity(playerOne)) as PlayerEntity;
});

describe("Movement Tests", () => {
    test("Test Pathfinding", async () => {
        // Test `getGeohashesForPath`
        expect(getGeohashesForPath("swbb81k4", ["e", "e"])).toMatchObject([
            "swbb81k4",
            "swbb81k6",
            "swbb81kd",
        ]);

        // Test `getPositionsForPath`
        var positions = getPositionsForPath({ row: 0, col: 0 }, ["e", "e"]);
        expect(positions).toMatchObject([
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
        ]);

        /*
         * Test pathfinding without obstacles
         */
        var path = await aStarPathfinding({
            rowStart: 0,
            colStart: 0,
            rowEnd: 3,
            colEnd: 3,
            getTraversalCost: async (row, col) => {
                return 0;
            },
        });
        expect(path).toMatchObject(["se", "se", "se"]);
        var path = await aStarPathfinding({
            rowStart: 3,
            colStart: 3,
            rowEnd: 0,
            colEnd: 0,
            getTraversalCost: async (row, col) => {
                return 0;
            },
        });
        expect(path).toMatchObject(["nw", "nw", "nw"]);
        var path = await aStarPathfinding({
            rowStart: 3,
            colStart: 3,
            rowEnd: 3,
            colEnd: 1,
            getTraversalCost: async (row, col) => {
                return 0;
            },
        });
        expect(path).toMatchObject(["w", "w"]);

        /*
         *Test with obstacles
         */

        /*
         * s 0 0 0 0
         * 0 0 0 0 0
         * 0 1 1 1 0
         * 0 0 0 0 0
         * 0 0 0 0 e
         */
        var path = await aStarPathfinding({
            rowStart: 0,
            colStart: 0,
            rowEnd: 4,
            colEnd: 4,
            getTraversalCost: async (row, col) => {
                if (
                    (row == 2 && col == 1) ||
                    (row == 2 && col == 2) ||
                    (row == 2 && col == 3)
                ) {
                    return 1;
                }
                return 0;
            },
        });
        expect(path).toMatchObject(["se", "e", "e", "se", "s", "s"]);
    });

    test("Test Movement", async () => {
        const playerOneGeohash = playerOne.loc[0];

        // Spawn tavern below playerOne
        const tavernGeohash = geohashNeighbour(playerOneGeohash, "s");
        let tavern = (await spawnItemAtGeohash({
            geohash: tavernGeohash,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.tavern.prop,
        })) as ItemEntity;
        const tavernOrigin = geohashNeighbour(playerOneGeohash, "s");
        expect(tavern).toMatchObject({
            loc: [
                tavernOrigin,
                geohashNeighbour(tavernOrigin, "e"),
                geohashNeighbour(tavernOrigin, "s"),
                geohashNeighbour(tavernOrigin, "se"),
            ],
            locT: "geohash",
        });

        // PlayerOne tries to move south (obstructed by tavern)
        await expect(
            crossoverCmdMove({ path: ["s"] }, { Cookie: playerOneCookies }),
        ).rejects.toThrowError("Path is not traversable");
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: "Path is not traversable",
        });
        await sleep(MS_PER_TICK * 2);

        // PlayerOne move each (unobstructed)
        await crossoverCmdMove({ path: ["e"] }, { Cookie: playerOneCookies });
        await sleep(MS_PER_TICK * 2);
        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        const biome = (
            await biomeAtGeohash(
                geohashNeighbour(playerOneGeohash, "e"),
                "geohash",
            )
        )[0];
        expect(biomes[biome].traversableSpeed).toBeGreaterThan(0);
        expect(playerOne.loc[0]).toBe(geohashNeighbour(playerOneGeohash, "e"));

        // PlayerOne tries to move south (obstructed by tavern)
        await expect(
            crossoverCmdMove({ path: ["s"] }, { Cookie: playerOneCookies }),
        ).rejects.toThrowError("Path is not traversable");
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: "Path is not traversable",
        });
        await sleep(MS_PER_TICK * 2);

        // PlayerOne move south east (unobstructed)
        const playerOneBefore = cloneDeep(playerOne);
        await crossoverCmdMove({ path: ["se"] }, { Cookie: playerOneCookies });
        await sleep(MS_PER_TICK * 2);
        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        expect(playerOne.loc[0]).toBe(
            geohashNeighbour(playerOneBefore.loc[0], "se"),
        );

        // PlayerOne move west (obstructed by tavern)
        await expect(
            crossoverCmdMove({ path: ["w"] }, { Cookie: playerOneCookies }),
        ).rejects.toThrowError("Path is not traversable");
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: "Path is not traversable",
        });
    });

    test("Test `move`", async () => {
        const playerOneGeohash = playerOne.loc[0];
        const path: Direction[] = ["s", "s", "s", "s"];
        const finalGeohash = geohashNeighbour(playerOneGeohash, "s", 4);

        await flushEventChannel(playerOneStream, "entities");
        playerOne = (await move(
            playerOne as PlayerEntity,
            path,
        )) as PlayerEntity;

        // Check in motion
        expect(isEntityInMotion(playerOne)).equal(true);

        // Check pthst
        expect(playerOne.pthst).toBe(playerOneGeohash);

        // Check pth
        expect(playerOne.pth).toMatchObject(["s", "s", "s", "s"]);

        // Check pthdur, pthclk
        expect(playerOne.pthclk + playerOne.pthdur).toBeGreaterThan(Date.now());

        // Check final destination
        expect(playerOne.loc[0]).toBe(finalGeohash);

        // Check correct events
        const entityEvents = await collectEventDataForDuration(
            playerOneStream,
            "entities",
        );
        expect(entityEvents.length).equal(1); // check no duplicates
        expect(entityEvents[0]).toMatchObject({
            event: "entities",
            players: [
                {
                    name: playerOne.name,
                    player: playerOne.player,
                    loc: [finalGeohash],
                    locT: "geohash",
                    pth: ["s", "s", "s", "s"],
                    pthst: playerOneGeohash,
                },
            ],
            op: "upsert",
        });
    });
});
