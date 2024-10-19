import { crossoverCmdCapture } from "$lib/crossover/client";
import { itemAttibutes } from "$lib/crossover/world/compendium";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { spawnItemAtGeohash } from "$lib/server/crossover/dm";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import type { ItemEntity } from "$lib/server/crossover/types";
import { describe, expect, test } from "vitest";
import {
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
} from "../utils";

describe("Capture Tests", async () => {
    let { geohash, playerOne, playerOneCookies, playerOneStream, playerTwo } =
        await createGandalfSarumanSauron();

    let controlMonument = (await spawnItemAtGeohash({
        geohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.control.prop,
    })) as ItemEntity;

    test("Capture control point", async () => {
        expect(itemAttibutes(controlMonument)).toMatchObject({
            name: "Monument of Control",
            destructible: false,
            description: `The monument stands as a towering monolith of shimmering, iridescent crystal. 
Its surface pulses with an otherworldly energy, casting a soft glow on the surrounding area. 
Ancient runes carved into its base hint at its power to shape the very fabric of the world.

You sense no influence from this monument.

The Monument of Control grants a faction significant influence over the region.
As control shifts, the surrounding landscape gradually transforms to reflect its nature - lush forests may wither into barren wastelands, or harsh deserts might bloom into verdant oases.`,
            variant: "default",
        });

        // Check not enough resouces to capture
        crossoverCmdCapture(
            {
                offer: {
                    currency: {
                        lum: 100,
                    },
                },
                target: controlMonument.item,
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
                target: controlMonument.item,
            },
            { Cookie: playerOneCookies },
        );
        var evs = await collectAllEventDataForDuration(playerOneStream);
        expect(evs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message:
                        "The Guild of the Historians influence grows in the area (100)",
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
                            item: controlMonument.item,
                            prop: "control",
                            vars: {
                                historian: 100,
                                influence:
                                    "The Guild of the Historians controls this monument.",
                            },
                        },
                    ],
                    op: "upsert",
                },
            ],
        });
    });
});
