import { isGeohashTraversableClient } from "$lib/crossover/game";
import { itemAttibutes } from "$lib/crossover/world/compendium";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import type { GeohashLocation } from "$lib/crossover/world/types";
import { spawnItemAtGeohash } from "$lib/server/crossover/dm";
import { isGeohashTraversableServer } from "$lib/server/crossover/utils";
import { describe, expect, test } from "vitest";
import { itemRecord } from "../../../src/store";
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

    let { tavern, portalOne } = await createTestItems({});

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

    test("Test Item Colliders", async () => {
        // Add items to store for isGeohashTraversableClient
        itemRecord.set({
            [portalOne.item]: portalOne,
            [tavern.item]: tavern,
        });

        // Should be traversable if cld=false
        var isTraversable = await isGeohashTraversableServer(
            portalOne.loc[0],
            portalOne.locT as GeohashLocation,
            portalOne.locI,
        );
        expect(isTraversable).toBe(true);
        isTraversable = await isGeohashTraversableClient(
            portalOne.loc[0],
            portalOne.locT as GeohashLocation,
            portalOne.locI,
        );
        expect(isTraversable).toBe(true);

        // Should not be traversable if cld=true
        isTraversable = await isGeohashTraversableServer(
            tavern.loc[0],
            tavern.locT as GeohashLocation,
            tavern.locI,
        );
        expect(isTraversable).toBe(false);
        isTraversable = await isGeohashTraversableClient(
            tavern.loc[0],
            tavern.locT as GeohashLocation,
            tavern.locI,
        );
        expect(isTraversable).toBe(false);
    });
});
