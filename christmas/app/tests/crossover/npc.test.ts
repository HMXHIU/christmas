import { crossoverCmdSay } from "$lib/crossover/client";
import { initializeClients, saveEntity } from "$lib/server/crossover/redis";
import { npcs } from "$lib/server/crossover/settings/npc";
import { getUserMetadata } from "$lib/server/crossover/utils";
import { beforeAll, expect, test } from "vitest";
import {
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
});

test("Test NPC Dialogue", async () => {
    innKeeper.locT = playerOne.locT;
    innKeeper.locI = playerOne.locI;
    innKeeper.loc = playerOne.loc;
    innKeeper = await saveEntity(innKeeper);

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
