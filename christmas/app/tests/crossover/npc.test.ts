import { crossoverCmdSay } from "$lib/crossover/client";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { spawnItem } from "$lib/server/crossover/dungeonMaster";
import { generateNPC } from "$lib/server/crossover/npc";
import { initializeClients, saveEntity } from "$lib/server/crossover/redis";
import type {
    Item,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { npcs } from "$lib/server/crossover/settings/npc";
import { getUserMetadata } from "$lib/server/crossover/utils";
import { beforeAll, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    generateRandomGeohash,
    waitForEventData,
} from "./utils";

// Player one

let region: string;
let geohash: string;

let playerOne: Player;
let playerOneCookies: string;
let playerOneStream: EventTarget;

// NPC
let npc: Player;

// Items
const woodendoorGeohash = generateRandomGeohash(8, "h9");
let woodendoor: Item;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Create players
    ({ region, geohash, playerOne, playerOneCookies, playerOneStream } =
        await createGandalfSarumanSauron());

    // Spawn Items
    woodendoor = await spawnItem({
        geohash: woodendoorGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodendoor.prop,
    });

    // Test full randomized generation
    npc = await generateNPC(npcs.innkeep.npc, {
        demographic: {},
        appearance: {},
    });

    // Test NPC Entity
    expect(npc).toMatchObject({
        name: "Inn Keeper",
        lgn: true,
        rgn: "@@@",
        locT: "geohash",
        locI: npc.player, // should be in its own instance
    });
});

test("Test NPC Dialogue", async () => {
    npc.locT = playerOne.locT;
    npc.locI = playerOne.locI;
    npc.loc = playerOne.loc;
    npc = (await saveEntity(npc as PlayerEntity)) as Player;

    // Test greetings
    crossoverCmdSay(
        { message: "", target: npc.player },
        { Cookie: playerOneCookies },
    );
    var feed = await waitForEventData(playerOneStream, "feed");
    expect(feed).toMatchObject({
        type: "message",
        message: "${message}",
        variables: {
            cmd: "say",
            player: npc.player,
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
    const npcUserMetadata = await getUserMetadata(npc.player);
    expect(npcUserMetadata).toMatchObject({
        publicKey: npc.player,
        crossover: {
            player: npc.player,
            name: npc.name,
            description: npcs.innkeep.descriptionTemplate,
            avatar: npc.avatar,
            demographic: {
                gender: npc.gen,
                race: npc.race,
                archetype: npc.arch,
            },
        },
    });

    // Test npc field
    expect(npc.npc?.startsWith("innkeep")).toBe(true);
    expect(npcUserMetadata?.crossover?.npc?.startsWith("innkeep")).toBe(true);

    // Test avatar
    const avatarMetadata = await (await fetch(npc.avatar)).json();
    expect(Object.keys(avatarMetadata)).includes("head");

    // Test secret key storage
});
