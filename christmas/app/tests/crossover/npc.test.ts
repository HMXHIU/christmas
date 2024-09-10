import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { spawnItem, spawnMonster } from "$lib/server/crossover/dungeonMaster";
import { generateNPC } from "$lib/server/crossover/npc";
import { initializeClients } from "$lib/server/crossover/redis";
import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { npcs } from "$lib/server/crossover/settings/npc";
import { getUserMetadata } from "$lib/server/crossover/utils";
import { beforeAll, expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

// Player one
const region = String.fromCharCode(...getRandomRegion());
let playerOne: Player;
const playerOneName = "Gandalf";
const playerOneGeohash = generateRandomGeohash(8, "h9");

// Monsters
let goblin: Monster;
const goblinGeohash = playerOneGeohash;
let dragon: Monster;
const dragonGeohash = generateRandomGeohash(8, "h9");

// Items
const woodendoorGeohash = generateRandomGeohash(8, "h9");
let woodendoor: Item;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Spawn player
    playerOne = (
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        })
    )[2];

    // Spawn monsters
    goblin = await spawnMonster({
        geohash: goblinGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        beast: "goblin",
    });
    dragon = await spawnMonster({
        geohash: dragonGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        beast: "dragon",
    });

    // Spawn Items
    woodendoor = await spawnItem({
        geohash: woodendoorGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodendoor.prop,
    });
});

test("Test `generateNPC`", async () => {
    // Test full randomized generation
    const npc = await generateNPC(npcs.innkeep.npc, {
        demographic: {},
        appearance: {},
    });

    // Test PlayerEntity
    expect(npc).toMatchObject({
        name: "Inn Keeper",
        lgn: true,
        rgn: "@@@",
        locT: "geohash",
    });

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

    // Test avatar
    const avatarMetadata = await (await fetch(npc.avatar)).json();
    expect(Object.keys(avatarMetadata)).includes("head");
});
