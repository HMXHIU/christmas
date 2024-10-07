import { entityStats } from "$lib/crossover/world/entity";
import {
    LOCATION_INSTANCE,
    MS_PER_TICK,
    TICKS_PER_TURN,
} from "$lib/crossover/world/settings";
import { entityDied, respawnPlayer } from "$lib/server/crossover/combat/utils";
import { clone } from "lodash-es";
import { beforeEach, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    resetEntityResources,
} from "./utils";

let {
    geohash,
    playerOne,
    playerOneCookies,
    playerTwoStream,
    playerOneStream,
    playerTwo,
} = await createGandalfSarumanSauron();

let { goblin } = await createGoblinSpiderDragon(geohash);

beforeEach(async () => {
    playerOne.loc = [geohash];
    playerTwo.loc = [geohash];
    await resetEntityResources(playerOne, playerTwo);
});

test("Test `entityDied`", () => {
    const playerOneAfter = clone(playerOne);
    playerOneAfter.hp = 0;
    expect(entityDied(playerOne, playerOneAfter)).toBe(true);
});

test("Test `respawnPlayer`", async () => {
    playerOne.hp = 0;
    playerOne.cha = 0;
    playerOne.mnd = 0;
    playerOne.lum = 10;
    playerOne.umb = 10;
    expect(await respawnPlayer(playerOne)).toMatchObject({
        ...entityStats(playerOne),
        lum: Math.floor(10 / 2),
        umb: Math.floor(10 / 2),
        buclk: MS_PER_TICK * TICKS_PER_TURN * 10,
        locT: "geohash",
        locI: LOCATION_INSTANCE,
    });
});
