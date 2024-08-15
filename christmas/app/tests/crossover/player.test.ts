import { minifiedEntity } from "$lib/crossover/utils";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { createItem, equipItem, takeItem } from "$lib/server/crossover/actions";
import { probeEquipment } from "$lib/server/crossover/player";
import { initializeClients } from "$lib/server/crossover/redis";
import { expect, test } from "vitest";
import { createGandalfSarumanSauron, waitForEventData } from "./utils";

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

    /*
     * Test probe equipment
     */

    await takeItem(playerTwo, steelPlate.item);
    await takeItem(playerTwo, steelPauldron.item);

    let playerTwoEquippedItems = await probeEquipment(
        playerOne,
        playerTwo.player,
    );

    expect(playerTwoEquippedItems.length).toBe(0);

    steelPlate = await equipItem(playerTwo, steelPlate.item, "ch");
    playerTwoEquippedItems = await probeEquipment(playerOne, playerTwo.player);

    expect(playerTwoEquippedItems).toMatchObject([steelPlate]);

    await expect(
        waitForEventData(playerOneStream, "entities"),
    ).resolves.toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [minifiedEntity(steelPlate)],
        op: "upsert",
    });
});
