import { crossoverCmdAccept } from "$lib/crossover/client";
import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands } from "$lib/crossover/ir";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { spawnItemInInventory } from "$lib/server/crossover/dm";
import { describe, expect, test } from "vitest";
import type { CTAEvent } from "../../../src/routes/api/crossover/stream/+server";
import {
    allActions,
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    waitForAnyEventData,
    waitForEventData,
} from "../utils";

describe("Give Tests", async () => {
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

    test("Give item to player", async () => {
        // Test command search
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: `give ${woodenClub.item} to ${playerTwo.name}`,
                player: playerOne,
                playerAbilities: [abilities.bruise, abilities.bandage],
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
        expect(
            feed.cta.message.startsWith(
                "Gandalf wants to give Wooden Club to you. You have 60 to *accept",
            ),
        ).toBeTruthy();

        // Accept the CTA
        crossoverCmdAccept(
            { token: feed.cta.token },
            { Cookie: playerTwoCookies },
        );

        let playerOneEvs: any;
        let playerTwoEvs: any;
        waitForAnyEventData(playerOneStream).then(
            (evs) => (playerOneEvs = evs),
        );
        await waitForAnyEventData(playerTwoStream).then(
            (evs) => (playerTwoEvs = evs),
        );

        expect(playerOneEvs).toMatchObject({
            feed: {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: playerTwo.player,
                    name: "Saruman",
                    message:
                        "Saruman beams with gratitude as they nod to you, 'Ah, many thanks for the Wooden Club, Gandalf!'",
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
                        "Gandalf hands you a 'Wooden Club' with a smile, 'Here you go, Saruman.'",
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
