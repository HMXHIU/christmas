import {
    crossoverCmdConfigureItem,
    crossoverCmdUseItem,
} from "$lib/crossover/client";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { spawnItemAtGeohash } from "$lib/server/crossover/dm";
import { fetchEntity, saveEntities } from "$lib/server/crossover/redis/utils";
import type { ItemEntity, PlayerEntity } from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createGandalfSarumanSauron, generateRandomGeohash } from "../utils";

let geohash: string;
let playerOne: PlayerEntity;
let playerTwo: PlayerEntity;
let playerThree: PlayerEntity;
let playerOneCookies: string;
let playerOneStream: EventTarget;
let playerThreeStream: EventTarget;
let playerTwoStream: EventTarget;

beforeAll(async () => {
    ({
        geohash,
        playerOne,
        playerTwo,
        playerThree,
        playerOneCookies,
        playerOneStream,
        playerTwoStream,
        playerThreeStream,
    } = await createGandalfSarumanSauron());

    // Test location geohash
    expect(playerOne.loc[0].length).toBe(worldSeed.spatial.unit.precision);
    expect(playerOne.loc[0].startsWith(geohash)).toBe(true);
});

beforeEach(async () => {
    geohash = generateRandomGeohash(8, "h9b");

    // playerOne and playerThree should be same location
    playerOne.loc = [geohash];
    playerThree.loc = [geohash];
    // Change playerTwo location away from playerOne & playerThree
    playerTwo.loc = [generateRandomGeohash(8, "h9r")];

    saveEntities(playerOne, playerTwo, playerThree);
});

describe("Item Integration Tests", () => {
    test("Test Portals Configuration And Usage", async () => {
        // Create portalOne at playerOne (public owner)
        let portalOne = await spawnItemAtGeohash({
            geohash: playerOne.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.portal.prop,
        });

        // Create portalTwo at playerTwo (public owner)
        let portalTwo = await spawnItemAtGeohash({
            geohash: playerTwo.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.portal.prop,
        });

        // Configure portals to point to each other (public anyone can configure)
        await crossoverCmdConfigureItem(
            {
                item: portalOne.item,
                variables: {
                    target: portalTwo.item,
                },
            },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 2);
        await crossoverCmdConfigureItem(
            {
                item: portalTwo.item,
                variables: {
                    target: portalOne.item,
                },
            },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 2);

        // Test `playerOne` uses `portalOne` to teleport to `portalTwo`
        await crossoverCmdUseItem(
            {
                target: portalOne.item,
                item: portalOne.item,
                utility: compendium.portal.utilities.teleport.utility,
            },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 4);

        var playerOneAfter = (await fetchEntity(
            playerOne.player,
        )) as PlayerEntity;
        expect(playerOneAfter.loc[0]).equal(portalTwo.loc[0]);
        playerOne = playerOneAfter;

        var portalOneAfter = (await fetchEntity(portalOne.item)) as ItemEntity;
        expect(portalOne.chg - portalOneAfter.chg).equal(
            compendium.portal.utilities.teleport.cost.charges,
        );
        portalOne = portalOneAfter;

        // Test `playerOne` uses `portalTwo` to teleport to `portalOne`
        await crossoverCmdUseItem(
            {
                target: portalTwo.item,
                item: portalTwo.item,
                utility: compendium.portal.utilities.teleport.utility,
            },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 8);

        var playerOneAfter = (await fetchEntity(
            playerOne.player,
        )) as PlayerEntity;
        expect(playerOneAfter.loc[0]).equal(portalTwo.loc[0]);

        var portalTwoAfter = (await fetchEntity(portalTwo.item)) as ItemEntity;
        expect(portalTwo.chg - portalTwoAfter.chg).equal(
            compendium.portal.utilities.teleport.cost.charges,
        );
    });
});
