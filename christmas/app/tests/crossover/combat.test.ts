import { initializeClients } from "$lib/server/crossover/redis";
import { beforeEach, describe } from "vitest";
import {
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    resetEntityResources,
} from "./utils";

await initializeClients(); // create redis repositories

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
    resetEntityResources(playerOne, playerTwo);
});

describe("Abilities Tests", () => {});
