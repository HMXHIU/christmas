import { crossoverCmdMove } from "$lib/crossover";
import {
    aStarPathfinding,
    geohashNeighbour,
    getGeohashesForPath,
    getPositionsForPath,
} from "$lib/crossover/utils";
import { biomeAtGeohash, biomes } from "$lib/crossover/world/biomes";
import { compendium } from "$lib/crossover/world/compendium";
import { spawnItem } from "$lib/server/crossover";
import type { ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

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
    var path = aStarPathfinding({
        rowStart: 0,
        colStart: 0,
        rowEnd: 3,
        colEnd: 3,
        getTraversalCost: (row, col) => {
            return 0;
        },
    });
    expect(path).toMatchObject(["se", "se", "se"]);
    var path = aStarPathfinding({
        rowStart: 3,
        colStart: 3,
        rowEnd: 0,
        colEnd: 0,
        getTraversalCost: (row, col) => {
            return 0;
        },
    });
    expect(path).toMatchObject(["nw", "nw", "nw"]);
    var path = aStarPathfinding({
        rowStart: 3,
        colStart: 3,
        rowEnd: 3,
        colEnd: 1,
        getTraversalCost: (row, col) => {
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
    var path = aStarPathfinding({
        rowStart: 0,
        colStart: 0,
        rowEnd: 4,
        colEnd: 4,
        getTraversalCost: (row, col) => {
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
    // Player one
    const playerOneName = "Gandalf";
    let playerOneGeohash = generateRandomGeohash(8, "h9");
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region: String.fromCharCode(...getRandomRegion()),
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    /*
     * Test obstructive item
     */

    // Spawn tavern below playerOne
    const tavernGeohash = geohashNeighbour(playerOneGeohash, "s"); // below playerOne

    let tavern = (await spawnItem({
        geohash: tavernGeohash,
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
        crossoverCmdMove({ direction: "s" }, { Cookie: playerOneCookies }),
    ).resolves.toMatchObject({
        status: "failure",
        message: "Cannot move s",
    });
    expect(playerOne.loc[0]).toBe(playerOneGeohash); // PlayerOne should not move

    // PlayerOne move each (unobstructed)
    playerOne.loc = (
        await crossoverCmdMove({ direction: "e" }, { Cookie: playerOneCookies })
    ).players?.[0].loc!;
    const biome = (
        await biomeAtGeohash(geohashNeighbour(playerOneGeohash, "e"))
    )[0];
    expect(biomes[biome].traversableSpeed).toBeGreaterThan(0);
    expect(playerOne.loc[0]).toBe(geohashNeighbour(playerOneGeohash, "e"));

    // PlayerOne tries to move south (obstructed by tavern)
    await expect(
        crossoverCmdMove({ direction: "s" }, { Cookie: playerOneCookies }),
    ).resolves.toMatchObject({
        status: "failure",
        message: "Cannot move s",
    });

    // PlayerOne move south east (unobstructed)
    var newLocation = (
        await crossoverCmdMove(
            { direction: "se" },
            { Cookie: playerOneCookies },
        )
    ).players?.[0].loc!;
    expect(newLocation[0]).toBe(geohashNeighbour(playerOne.loc[0], "se"));
    playerOne.loc = newLocation;

    // PlayerOne move west (obstructed by tavern)
    await expect(
        crossoverCmdMove({ direction: "w" }, { Cookie: playerOneCookies }),
    ).resolves.toMatchObject({
        status: "failure",
        message: "Cannot move w",
    });
    expect(playerOne.loc[0]).toBe(newLocation[0]); // PlayerOne should not move
});
