import { compendium } from "$lib/crossover/world/settings/compendium";
import { createItem } from "$lib/server/crossover/actions/item";
import { initializeClients } from "$lib/server/crossover/redis";
import { test } from "vitest";
import { createGandalfSarumanSauron } from "./utils";

test("Test Player", async () => {
    await initializeClients(); // create redis repositories
    let {
        region,
        geohash,
        playerOne,
        playerTwo,
        playerOneCookies,
        playerTwoCookies,
        playerOneStream,
        playerTwoStream,
    } = await createGandalfSarumanSauron();

    let steelPlate = await createItem(
        playerTwo,
        geohash,
        compendium.steelplate.prop,
    );
    const steelPauldron = await createItem(
        playerTwo,
        geohash,
        compendium.steelpauldron.prop,
    );
});
