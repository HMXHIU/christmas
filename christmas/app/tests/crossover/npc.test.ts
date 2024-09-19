import { crossoverCmdGive, crossoverCmdSay } from "$lib/crossover/client";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { spawnItemInInventory } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import { npcs } from "$lib/server/crossover/settings/npc";
import { getUserMetadata } from "$lib/server/crossover/utils";
import { beforeAll, expect, test } from "vitest";
import {
    collectAllEvents,
    createGandalfSarumanSauron,
    createNPCs,
    waitForEventData,
} from "./utils";

await initializeClients(); // create redis repositories

let { playerOne, playerOneCookies, playerOneStream } =
    await createGandalfSarumanSauron();
let { innKeeper } = await createNPCs({});

beforeAll(async () => {
    // Test NPC Entity
    expect(innKeeper).toMatchObject({
        name: "Inn Keeper",
        lgn: true,
        rgn: "@@@",
        locT: "geohash",
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

    // Test ignore
});

test("Test Give NPC", async () => {
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
    var evs = await collectAllEvents(playerOneStream);
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
});

test("Test `generateNPC`", async () => {
    // Test UserMetadata
    const npcUserMetadata = await getUserMetadata(innKeeper.player);
    expect(npcUserMetadata).toMatchObject({
        publicKey: innKeeper.player,
        crossover: {
            player: innKeeper.player,
            name: innKeeper.name,
            description: npcs.innkeep.descriptionTemplate,
            avatar: innKeeper.avatar,
            demographic: {
                gender: innKeeper.gen,
                race: innKeeper.race,
                archetype: innKeeper.arch,
            },
        },
    });

    // Test npc field
    expect(innKeeper.npc?.startsWith("innkeep")).toBe(true);
    expect(npcUserMetadata?.crossover?.npc?.startsWith("innkeep")).toBe(true);

    // Test avatar
    const avatarMetadata = await (await fetch(innKeeper.avatar)).json();
    expect(Object.keys(avatarMetadata)).includes("head");

    // Test secret key storage
});
