import { crossoverCmdLook } from "$lib/crossover/client";
import { minifiedEntity } from "$lib/crossover/utils";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { spawnMonster } from "$lib/server/crossover/dm";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createTestItems,
    generateRandomGeohash,
    waitForEventData,
} from "../utils";

let {
    geohash,
    playerOne,
    playerTwo,
    playerThree,
    playerOneCookies,
    playerOneStream,
} = await createGandalfSarumanSauron();
let { woodenDoor } = await createTestItems({});
let goblin = await spawnMonster({
    geohash,
    locationType: "geohash",
    locationInstance: LOCATION_INSTANCE,
    beast: "goblin",
});

beforeAll(async () => {
    woodenDoor.loc = [geohash];
    woodenDoor = await saveEntity(woodenDoor);
});

beforeEach(async () => {
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
        crossoverCmdLook({}, { Cookie: playerOneCookies });

        // playerOne should not see playerTwo
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            players: [
                minifiedEntity(playerOne, {
                    location: true,
                    stats: true,
                    timers: true,
                    demographics: true,
                }), // check self should be full entity
                {
                    name: "Sauron",
                    player: playerThree.player,
                    gen: "male",
                    arch: "believer",
                    race: "human",
                    hp: 11, // check should receive statas
                    cha: 1,
                    mnd: 1,
                    lum: 0,
                    umb: 0,
                    loc: [geohash], // check should receive location
                    locT: "geohash",
                    locI: "@",
                },
            ],
            monsters: [
                {
                    beast: "goblin",
                    monster: goblin.monster,
                    hp: 10, // check should receive monster stats
                    cha: 1,
                    mnd: 1,
                    lum: 0,
                    umb: 0,
                    loc: [geohash], // check should receive monster location
                    locT: "geohash",
                    locI: "@",
                },
            ],
            items: [
                {
                    name: "Wooden Door",
                    item: woodenDoor.item,
                    prop: "woodendoor",
                    state: "default",
                    vars: {},
                    chg: 0,
                    dur: 100, // check should receive item stats
                    loc: [geohash], // check should receive item location
                    locT: "geohash",
                    locI: "@",
                },
            ],
            op: "replace",
        });
    });
});
