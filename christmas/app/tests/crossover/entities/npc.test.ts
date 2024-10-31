import {
    crossoverCmdGive,
    crossoverCmdLearn,
    crossoverCmdSay,
    crossoverCmdTrade,
} from "$lib/crossover/client";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type { BarterSerialized } from "$lib/crossover/world/types";
import { spawnItemInInventory } from "$lib/server/crossover/dm";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import { npcs } from "$lib/server/crossover/settings/npc";
import { getUser } from "$lib/server/user";
import { sleep } from "$lib/utils";
import { beforeAll, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createNPCs,
    waitForAnyEventData,
    waitForEventData,
} from "../utils";

describe("Test NPCs", async () => {
    let { playerOne, playerOneCookies, playerOneStream } =
        await createGandalfSarumanSauron();
    let { innKeeper } = await createNPCs({});

    beforeAll(async () => {
        // Test NPC Entity
        expect(innKeeper).toMatchObject({
            name: "Inn Keeper",
            lgn: true,
            rgn: "@@@",
            locT: "limbo",
            locI: innKeeper.player, // should be in its own instance
        });

        // Set innKeeper location at playerOne
        innKeeper.locT = playerOne.locT;
        innKeeper.locI = playerOne.locI;
        innKeeper.loc = playerOne.loc;
        innKeeper = await saveEntity(innKeeper);
    });

    test("Test Greet NPC", async () => {
        // Test greetings
        crossoverCmdSay(
            { message: "", target: innKeeper.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: innKeeper.player,
                name: "Inn Keeper",
                message:
                    "Inn Keeper greets you, 'Well met Gandalf, you may *rest* here'.",
            },
            event: "feed",
        });
        await sleep(MS_PER_TICK * 4);

        // Test ignore
    });

    test("Test Give Item To NPC", async () => {
        // Give playerOne a potion
        const potion = await spawnItemInInventory({
            entity: playerOne,
            prop: compendium.potionofhealth.prop,
        });

        // playerOne give NPC potion
        crossoverCmdGive(
            { item: potion.item, receiver: innKeeper.player },
            { Cookie: playerOneCookies },
        );
        var evs = await waitForAnyEventData(playerOneStream);
        expect(evs).toMatchObject({
            feed: {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: innKeeper.player,
                    name: "Inn Keeper",
                    message: `Inn Keeper beams with gratitude as they nod to you, 'Ah, many thanks for the Potion of Health, ${playerOne.name}!'`,
                },
                event: "feed",
            },
            entities: {
                event: "entities",
                players: [],
                monsters: [],
                items: [
                    {
                        item: potion.item,
                        loc: [innKeeper.player],
                        locT: "inv",
                        locI: "@",
                    },
                ],
                op: "upsert",
            },
        });
        await sleep(MS_PER_TICK * 4);
    });

    test("Test Trade With NPC", async () => {
        const offer: BarterSerialized = {
            currency: {
                lum: 100,
            },
        };
        const receive: BarterSerialized = {
            props: [compendium.potionofhealth.prop],
        };

        // Try to trade with NPC
        crossoverCmdTrade(
            {
                offer,
                receive,
                seller: innKeeper.player,
                buyer: playerOne.player,
            },
            { Cookie: playerOneCookies },
        );
        var evs = await waitForAnyEventData(playerOneStream);
        expect(evs).toMatchObject({
            feed: {
                type: "message",
                message: "${name} says ${message}",
                variables: {
                    cmd: "say",
                    player: innKeeper.player,
                    name: "Inn Keeper",
                    message:
                        "I’m not certain I have exactly what you seek, but why not take a moment to *browse* through my wares? Perhaps something else will catch your eye.",
                },
                event: "feed",
            },
        });
        await sleep(MS_PER_TICK * 4);
    });

    test("Test Learn From NPC", async () => {
        // Try to learn from NPC without enough skill levels
        crossoverCmdLearn(
            { skill: "exploration", teacher: innKeeper.player },
            { Cookie: playerOneCookies },
        );
        var evs = await waitForAnyEventData(playerOneStream);
        expect(evs).toMatchObject({
            feed: {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: innKeeper.player,
                    name: "Inn Keeper",
                    message:
                        "Inn Keeper furrows his brow. 'This skill lies beyond even my grasp. Seek out one more learned than I.'",
                },
                event: "feed",
            },
        });

        // Give npc enough skill level, but player still does not have enough experience
        innKeeper.skills.exploration = 10;
        innKeeper = await saveEntity(innKeeper);
        crossoverCmdLearn(
            { skill: "exploration", teacher: innKeeper.player },
            { Cookie: playerOneCookies },
        );
        evs = await waitForAnyEventData(playerOneStream);
        expect(evs).toMatchObject({
            feed: {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: innKeeper.player,
                    name: "Inn Keeper",
                    message:
                        "Despite your best efforts, the skill eludes you, perhaps with more experience.",
                },
                event: "feed",
            },
        });

        // Give player enough lumia
        playerOne.lum = 1000;
        playerOne = await saveEntity(playerOne);
        const skillBefore = playerOne.skills.exploration ?? 0;
        crossoverCmdLearn(
            { skill: "exploration", teacher: innKeeper.player },
            { Cookie: playerOneCookies },
        );
        evs = await waitForAnyEventData(playerOneStream);
        expect(evs).toMatchObject({
            feed: {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: innKeeper.player,
                    name: "Inn Keeper",
                    message: "Inn Keeper hands you a worn map and a compass.",
                },
                event: "feed",
            },
            entities: {
                event: "entities",
                players: [
                    {
                        player: playerOne.player,
                        skills: {
                            exploration: skillBefore + 1,
                        },
                        pthclk: 0,
                        pthdur: 0,
                        pth: [],
                        pthst: "",
                    },
                ],
                monsters: [],
                items: [],
                op: "upsert",
            },
            action: {
                action: "learn",
                event: "action",
            },
        });
        await sleep(MS_PER_TICK * 4);
    });

    test("Test `spawnNPC`", async () => {
        // Test UserMetadata
        const npcUserMetadata = await getUser(innKeeper.player);
        expect(npcUserMetadata).toMatchObject({
            publicKey: innKeeper.player,
            crossover: {
                player: innKeeper.player,
                name: innKeeper.name,
                description: npcs.innkeeper.descriptionTemplate,
                avatar: innKeeper.avatar,
                demographic: {
                    gender: innKeeper.gen,
                    race: innKeeper.race,
                    archetype: innKeeper.arch,
                },
            },
        });

        // Test npc field
        expect(innKeeper.npc?.startsWith("innkeeper")).toBe(true);
        expect(npcUserMetadata?.crossover?.npc?.startsWith("innkeeper")).toBe(
            true,
        );

        // Test avatar
        const avatarMetadata = await (await fetch(innKeeper.avatar)).json();
        expect(Object.keys(avatarMetadata)).includes("head");

        // Test secret key storage
    });
});
