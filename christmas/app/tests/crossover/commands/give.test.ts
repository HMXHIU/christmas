import { crossoverCmdAccept } from "$lib/crossover/client";
import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands } from "$lib/crossover/ir";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { spawnItemInInventory } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import { sleep } from "$lib/utils";
import { beforeAll, describe, expect, test } from "vitest";
import type { CTAEvent } from "../../../src/routes/api/crossover/stream/+server";
import {
    allActions,
    collectAllEvents,
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    waitForEventData,
} from "../utils";

await initializeClients(); // create redis repositories

let {
    playerOne,
    playerTwo,
    playerOneCookies,
    playerOneStream,
    playerTwoCookies,
    playerTwoStream,
} = await createGandalfSarumanSauron();
let { goblin, dragon } = await createGoblinSpiderDragon();
let woodenClub = await spawnItemInInventory({
    entity: playerOne,
    prop: compendium.woodenclub.prop,
});

beforeAll(async () => {
    // Wait for the entities to be created
    await sleep(MS_PER_TICK * 2);
});

describe("Give Tests", () => {
    test("Give item to player", async () => {
        // Test command search
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: `give ${woodenClub.item} to ${playerTwo.name}`,
                player: playerOne,
                playerAbilities: [
                    abilities.scratch,
                    abilities.bandage,
                    abilities.swing,
                ],
                playerItems: [woodenClub],
                actions: allActions,
                monsters: [goblin, dragon],
                players: [playerOne, playerTwo],
                items: [woodenClub],
                skills: [...SkillLinesEnum],
            });
        expect(commands).toMatchObject([
            [
                {
                    action: "give",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        player: playerTwo.player,
                    },
                    item: {
                        item: woodenClub.item,
                    },
                },
                {
                    query: `give ${woodenClub.item} to saruman`,
                    queryIrrelevant: "to",
                },
            ],
        ]);

        // Test execute command
        executeGameCommand(commands[0], { Cookie: playerOneCookies });

        // Check playerTwo got CTA event
        var feed = (await waitForEventData(playerTwoStream, "cta")) as CTAEvent;
        await expect(feed).toMatchObject({
            cta: {
                name: "Gift",
            },
            event: "cta",
        });
        expect(
            feed.cta.description.startsWith(
                "Gandalf wants to give Wooden Club to you. You have 60 to *accept",
            ),
        ).toBeTruthy();
        await sleep(MS_PER_TICK * actions.give.ticks * 2);

        // Accept the CTA
        crossoverCmdAccept(
            { token: feed.cta.token },
            { Cookie: playerTwoCookies },
        );

        let playerOneEvs: any;
        let playerTwoEvs: any;
        collectAllEvents(playerOneStream).then((evs) => (playerOneEvs = evs));
        collectAllEvents(playerTwoStream).then((evs) => (playerTwoEvs = evs));
        await sleep(MS_PER_TICK * 4);

        expect(playerOneEvs).toMatchObject({
            feed: {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: playerTwo.player,
                    name: "Saruman",
                    message:
                        "Saruman beams with gratitude as they nod to you, 'Ah, many thanks for the Wooden Club, Saruman!'",
                },
                event: "feed",
            },
            entities: {
                event: "entities",
                players: [],
                monsters: [],
                items: [
                    {
                        item: woodenClub.item,
                        prop: "woodenclub",
                        loc: [playerTwo.player],
                        locT: "inv",
                        locI: "@",
                    },
                ],
                op: "upsert",
            },
        });
        expect(playerTwoEvs).toMatchObject({
            feed: {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: playerOne.player,
                    message:
                        "Gandalf hands you a Wooden Club with a smile, 'Here you go, Saruman. Hope it serves you well.'",
                },
                event: "feed",
            },
            entities: {
                event: "entities",
                players: [],
                monsters: [],
                items: [
                    {
                        item: woodenClub.item,
                        prop: "woodenclub",
                        loc: [playerTwo.player],
                        locT: "inv",
                        locI: "@",
                    },
                ],
                op: "upsert",
            },
        });
    });
});
