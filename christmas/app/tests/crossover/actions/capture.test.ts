import { crossoverCmdCapture } from "$lib/crossover/client";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { spawnItemAtGeohash } from "$lib/server/crossover/dm";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import type { ItemEntity } from "$lib/server/crossover/types";
import { beforeEach, describe, expect, test } from "vitest";
import {
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
    resetEntityResources,
} from "../utils";

describe("Capture Tests", async () => {
    let {
        geohash,
        playerOne,
        playerOneCookies,
        playerOneStream,
        playerTwo,
        playerTwoCookies,
        playerTwoStream,
    } = await createGandalfSarumanSauron();

    let controlPoint = (await spawnItemAtGeohash({
        geohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.control.prop,
    })) as ItemEntity;

    beforeEach(async () => {
        await resetEntityResources(playerOne, playerTwo);
    });

    test("Capture control point", async () => {
        // Check not enough resouces to capture
        crossoverCmdCapture(
            {
                offer: {
                    currency: {
                        lum: 100,
                    },
                },
                target: controlPoint.item,
            },
            { Cookie: playerOneCookies },
        );
        var evs = await collectAllEventDataForDuration(playerOneStream);
        expect(evs).toMatchObject({
            feed: [
                {
                    type: "error",
                    message: "You do not have 100 lum.",
                    event: "feed",
                },
            ],
        });

        // Check enough resources to capture
        playerOne.lum = 200;
        playerOne = await saveEntity(playerOne);
        crossoverCmdCapture(
            {
                offer: {
                    currency: {
                        lum: 100,
                    },
                },
                target: controlPoint.item,
            },
            { Cookie: playerOneCookies },
        );
        var evs = await collectAllEventDataForDuration(playerOneStream);
        expect(evs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "human influence grows in the area (100)",
                    event: "feed",
                },
            ],
            entities: [
                {
                    players: [
                        {
                            player: playerOne.player,
                            lum: 100,
                        },
                    ],
                    op: "upsert",
                },
                {
                    items: [
                        {
                            item: controlPoint.item,
                            prop: "control",
                            vars: {
                                human: 100,
                            },
                        },
                    ],
                    op: "upsert",
                },
            ],
        });
    });
});
