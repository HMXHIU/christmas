import { geohashNeighbour } from "$lib/crossover/utils";
import {
    entityAbilities,
    entityActions,
    entityAttributes,
    entityCurrencyReward,
    entityLevel,
    entitySkills,
    entityStats,
} from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    spawnItemAtGeohash,
    spawnMonster,
} from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import { expect, test } from "vitest";
import { createGoblinSpiderDragon, generateRandomGeohash } from "../utils";

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
        monster: goblin.monster,
        name: "goblin",
        beast: "goblin",
        locT: "geohash",
        locI: "@",
        ...entityStats(goblin),
        skills: entitySkills(goblin), // monsters do not have skills from demographics
        buclk: 0,
        buf: [],
        dbuf: [],
        pthclk: 0,
        pthdur: 0,
        pth: [],
        pthst: "",
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

test("Test Monster Abilities, Actions, Attributes, Level, Skills, Stats", () => {
    /*
     * Test monster `entityStats`
     */

    // Check abilities
    const abilities = entityAbilities(goblin);
    expect(abilities).toMatchObject(["eyePoke", "bandage"]);

    // Check actions
    const actions = entityActions(goblin);
    expect(actions).toMatchObject(["attack", "move", "look", "say"]);

    // Check attributes
    const attributes = entityAttributes(goblin);
    expect(attributes).toMatchObject({
        str: 11,
        dex: 11,
        con: 11,
        mnd: 10,
        fth: 10,
        cha: 10,
    });

    // Check level
    const level = entityLevel(goblin);
    expect(level).toEqual(1);

    // Check skills
    const skills = entitySkills(goblin);
    expect(skills).toMatchObject({
        dirtyfighting: 1,
        firstaid: 1,
        monster: 1,
        beast: 1,
    });

    // Check stats
    const stats = entityStats(goblin);
    expect(stats).toMatchObject({
        hp: 10,
        mnd: 1,
        cha: 1,
    });

    /*
     * Test `entityCurrencyReward`
     */
    expect(entityCurrencyReward(goblin)).toMatchObject({
        lum: 10,
        umb: 0,
    });
    expect(entityCurrencyReward(dragon)).toMatchObject({
        lum: 80,
        umb: 0,
    });
});
