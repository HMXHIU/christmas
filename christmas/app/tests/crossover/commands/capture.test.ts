import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands } from "$lib/crossover/ir";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { spawnItemAtGeohash } from "$lib/server/crossover/dm";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import type { ItemEntity } from "$lib/server/crossover/types";
import { describe, expect, test } from "vitest";
import {
    allActions,
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
} from "../utils";

describe("Capture Tests", async () => {
    let { geohash, playerOne, playerOneCookies, playerOneStream } =
        await createGandalfSarumanSauron();

    let controlMonument = (await spawnItemAtGeohash({
        geohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.control.prop,
    })) as ItemEntity;

    test("Capture a control monument", async () => {
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: `capture ${controlMonument.item} with 100lum`,
                player: playerOne,
                playerAbilities: [abilities.bruise, abilities.bandage],
                playerItems: [],
                actions: allActions,
                monsters: [],
                players: [playerOne],
                items: [controlMonument],
                skills: [...SkillLinesEnum],
            });
        expect(commands).toMatchObject([
            [
                {
                    action: "capture",
                    range: 2,
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: controlMonument.item,
                        name: "Monument of Control",
                        prop: "control",
                    },
                    offer: {
                        items: [],
                        props: [],
                        currency: {
                            lum: 100,
                            umb: 0,
                        },
                    },
                },
                {
                    query: `capture ${controlMonument.item} with 100lum`,
                    queryIrrelevant: "with",
                },
            ],
        ]);

        // Give enough to offer
        playerOne.lum = 100;
        playerOne = await saveEntity(playerOne);

        // Test execute command
        executeGameCommand(commands[0], { Cookie: playerOneCookies });
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
                    event: "entities",
                    players: [
                        {
                            player: playerOne.player,
                            lum: 0, // check used offering
                        },
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
                {
                    event: "entities",
                    items: [
                        {
                            name: "Monument of Control",
                            item: controlMonument.item,
                            prop: "control",
                            vars: {
                                historian: 100, // check gain influence
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
