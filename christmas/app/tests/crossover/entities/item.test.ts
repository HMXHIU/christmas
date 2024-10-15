import { itemAttibutes } from "$lib/crossover/world/compendium";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { spawnItemAtGeohash } from "$lib/server/crossover/dm";
import { describe, expect, test } from "vitest";
import { createGandalfSarumanSauron, createTestItems } from "../utils";

describe("Test Items", async () => {
    let {
        region,
        geohash,
        playerOne,
        playerTwo,
        playerThree,
        playerOneCookies,
        playerOneStream,
        playerTwoStream,
        playerThreeStream,
    } = await createGandalfSarumanSauron();

    let { tavern } = await createTestItems({});

    test("Test Item Variable Substitution", async () => {
        const doorExit = await spawnItemAtGeohash({
            prop: "exit",
            geohash,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            variables: {
                name: "Tavern Door", // change the name of the item
                description: "A door exiting the tavern",
                target: tavern.item,
            },
        });

        expect(doorExit.name).toBe("Tavern Door");

        expect(itemAttibutes(doorExit)).toMatchObject({
            name: "Tavern Door", // check name changed
            destructible: false,
            description: "A door exiting the tavern",
            variant: "default",
        });
    });
});
