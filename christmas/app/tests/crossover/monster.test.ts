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
import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { beforeAll, expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

// Player one
const region = String.fromCharCode(...getRandomRegion());
let playerOne: Player;
const playerOneName = "Gandalf";
const playerOneGeohash = generateRandomGeohash(8, "h9");

// Monsters
let goblin: Monster;
const goblinGeohash = playerOneGeohash;
let dragon: Monster;
const dragonGeohash = generateRandomGeohash(8, "h9");

// Items
const woodendoorGeohash = generateRandomGeohash(8, "h9");
let woodendoor: Item;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Spawn player
    playerOne = (
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        })
    )[2];

    // Spawn monsters
    goblin = await spawnMonster({
        geohash: goblinGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        beast: "goblin",
    });
    dragon = await spawnMonster({
        geohash: dragonGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        beast: "dragon",
    });

    // Spawn Items
    woodendoor = await spawnItemAtGeohash({
        geohash: woodendoorGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodendoor.prop,
    });
});

test("Test Monster", async () => {
    /*
     * Test `spawnMonster`
     */

    // Test dragon (3x3 grid)
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
        loc: [playerOneGeohash],
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
    await expect(
        spawnMonster({
            geohash: woodendoorGeohash,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            beast: "goblin",
        }),
    ).rejects.toThrow(`Cannot spawn goblin at ${woodendoorGeohash}`);
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
