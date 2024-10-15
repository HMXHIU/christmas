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
            prop: "portal",
            geohash,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            variables: {
                target: tavern.item,
                description: "A door exiting the tavern",
                state: "hidden", // use reserved `state` variable to specify initial state
                name: "Tavern Door",
            },
        });
        expect(itemAttibutes(doorExit)).toMatchObject({
            name: "Tavern Door",
            destructible: false,
            description: "A door exiting the tavern",
            variant: "hidden", // check spawned with hidden state
        });
    });
});
