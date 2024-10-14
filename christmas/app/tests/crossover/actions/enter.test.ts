import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { enterItem } from "$lib/server/crossover/actions/item";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import { substituteVariablesRecursively } from "$lib/utils";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
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

    let { tavern, worldAsset, worldAssetUrl } = await createTestItems({});

    beforeAll(async () => {
        // Configure player positions
        playerOne.loc = [tavern.loc[0]];
        playerOne = await saveEntity(playerOne);
        playerTwo.loc = [tavern.loc[0]];
        playerTwo = await saveEntity(playerTwo);
        playerThree.loc = [tavern.loc[0]];
        playerThree = await saveEntity(playerThree);
    });

    beforeEach(async () => {
        // Reset entities locations
        playerOne.loc = [tavern.loc[0]];
        playerOne.locT = "geohash";
        playerOne.locI = LOCATION_INSTANCE;
        playerOne = await saveEntity(playerOne);

        playerTwo.loc = [tavern.loc[0]];
        playerTwo.locT = "geohash";
        playerTwo.locI = LOCATION_INSTANCE;
        playerTwo = await saveEntity(playerTwo);

        playerThree.loc = [tavern.loc[0]];
        playerThree.locT = "geohash";
        playerThree.locI = LOCATION_INSTANCE;
        playerThree = await saveEntity(playerThree);
    });

    test("Test Enter Tavern", async () => {
        // Test prop as world attribute
        expect(compendium[tavern.prop].world != null).toBe(true);

        // Test variable substitution
        const propWorld = substituteVariablesRecursively(
            compendium[tavern.prop].world as any,
            {
                ...tavern.vars,
                self: tavern,
            },
        );
        expect(propWorld).toMatchObject({
            locationInstance: tavern.item, // use tavern.item as the locationInstance
            locationType: "in",
            geohash: tavern.loc[0],
            world: tavern.item, // use tavern.item as the unique worldId
            uri: worldAssetUrl,
        });

        // playerOne enter tavern
        const { player: playerAfter, pois } = await enterItem(
            playerOne,
            tavern.item,
        );

        // Check player spawn point
        const spawnPoint = pois.find(
            (p) => "spawn" in p && p.spawn === "player",
        );
        if (spawnPoint) {
            expect(playerAfter.loc[0]).toBe(spawnPoint.geohash);
        }
        // Check player location is inside the tavern (if no spawn point)
        else {
            expect(playerAfter.loc[0]).toBe(tavern.loc[0]);
        }
        expect(playerAfter).toMatchObject({
            locT: propWorld.locationType,
            locI: propWorld.locationInstance,
        });
    });
});
