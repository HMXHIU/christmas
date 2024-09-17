import { geohashNeighbour } from "$lib/crossover/utils";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { entityStats } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    spawnItemAtGeohash,
    spawnMonster,
} from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import { expect, test } from "vitest";
import { createGoblinSpiderDragon, generateRandomGeohash } from "./utils";

await initializeClients(); // create redis repositories

let { goblin, dragon } = await createGoblinSpiderDragon();

let woodenDoor = await spawnItemAtGeohash({
    geohash: generateRandomGeohash(8, "h9"),
    locationType: "geohash",
    locationInstance: LOCATION_INSTANCE,
    prop: compendium.woodendoor.prop,
});

test("Test Monster", async () => {
    /*
     * Test `spawnMonster`
     */

    // Test dragon (3x3 grid)
    const dragonGeohash = dragon.loc[0];
    expect(dragon).toMatchObject({
        loc: [
            // row 1
            dragonGeohash,
            geohashNeighbour(dragonGeohash, "e"),
            geohashNeighbour(geohashNeighbour(dragonGeohash, "e"), "e"),
            // row 2
            geohashNeighbour(dragonGeohash, "s"),
            geohashNeighbour(geohashNeighbour(dragonGeohash, "s"), "e"),
            geohashNeighbour(
                geohashNeighbour(geohashNeighbour(dragonGeohash, "s"), "e"),
                "e",
            ),
            // row 3
            geohashNeighbour(geohashNeighbour(dragonGeohash, "s"), "s"),
            geohashNeighbour(
                geohashNeighbour(geohashNeighbour(dragonGeohash, "s"), "s"),
                "e",
            ),
            geohashNeighbour(
                geohashNeighbour(
                    geohashNeighbour(geohashNeighbour(dragonGeohash, "s"), "s"),
                    "e",
                ),
                "e",
            ),
        ],
        locT: "geohash",
    });

    // Spawn goblin (1x1 grid)
    expect(goblin).toMatchObject({
        name: "goblin",
        beast: "goblin",
        locT: "geohash",
        locI: "@",
        hp: 10,
        mp: 10,
        st: 10,
        ap: 4,
        skills: {
            beast: 1,
            dirtyfighting: 1,
            firstaid: 1,
        },
        buf: [],
        dbuf: [],
    });

    // Test cannot spawn monster on collider
    const woodenDoorGeohash = woodenDoor.loc[0];
    await expect(
        spawnMonster({
            geohash: woodenDoorGeohash,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            beast: "goblin",
        }),
    ).rejects.toThrow(`Cannot spawn goblin at ${woodenDoorGeohash}`);
});

test("Test Monster Stats", () => {
    /*
     * Test monster `entityStats`
     */

    expect(entityStats(goblin)).toMatchObject({
        hp: 10,
        mp: 10,
        st: 10,
        ap: 4,
    });
    expect(entityStats(dragon)).toMatchObject({
        hp: 112,
        mp: 112,
        st: 112,
        ap: 4,
    });

    /*
     * Test `monsterLUReward`
     */
    expect(monsterLUReward(goblin)).toMatchObject({
        lum: 1,
        umb: 0,
    });
    expect(monsterLUReward(dragon)).toMatchObject({
        lum: 8,
        umb: 0,
    });
});
