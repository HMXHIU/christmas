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
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type { Direction } from "$lib/crossover/world/types";
import { move } from "$lib/server/crossover/actions";
import { spawnItemAtGeohash } from "$lib/server/crossover/dm";
import { fetchEntity, saveEntity } from "$lib/server/crossover/redis/utils";
import type { ItemEntity, PlayerEntity } from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { cloneDeep } from "lodash-es";
import { beforeEach, describe, expect, test } from "vitest";
import {
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
    flushEventChannel,
    generateRandomGeohash,
    waitForEventData,
} from "../utils";

describe("Movement Tests", async () => {
    let { playerOne, playerOneCookies, playerOneStream } =
        await createGandalfSarumanSauron();

    beforeEach(async () => {
        // Randomize playerOne location
        playerOne.loc = [generateRandomGeohash(8, "h9b")];
        playerOne = await saveEntity(playerOne);
    });

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
        crossoverCmdMove({ path: ["s"] }, { Cookie: playerOneCookies });

        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: "Path is not traversable.",
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
        crossoverCmdMove({ path: ["s"] }, { Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: "Path is not traversable.",
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
        crossoverCmdMove({ path: ["w"] }, { Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "error",
            message: "Path is not traversable.",
        });
    });

    test("Test `move`", async () => {
        await flushEventChannel(playerOneStream, "entities");

        const playerOneGeohash = playerOne.loc[0];
        const path: Direction[] = ["s", "s", "s", "s"];
        const finalGeohash = geohashNeighbour(playerOneGeohash, "s", 4);

        // Move along path
        move(playerOne, path);
        const evs = await collectAllEventDataForDuration(playerOneStream);
        expect(evs).toMatchObject({
            feed: [],
            entities: [
                {
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
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [],
        });

        // Check final entity
        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        expect(playerOne.pthst).toBe(playerOneGeohash);
        expect(playerOne.pth).toMatchObject(["s", "s", "s", "s"]);
        expect(playerOne.loc[0]).toBe(finalGeohash);

        // Test in motion
        move(playerOne, ["n", "n", "n", "n"]);
        await sleep(MS_PER_TICK * actions.move.ticks);
        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;

        // Check in motion
        expect(playerOne.pthclk + playerOne.pthdur).toBeGreaterThan(Date.now());
        expect(isEntityInMotion(playerOne)).equal(true);
    });
});
