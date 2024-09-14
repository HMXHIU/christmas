import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    learningDialoguesForSkill,
    skillLevelProgression,
} from "$lib/crossover/world/skills";
import {
    spawnItemAtGeohash,
    spawnMonster,
} from "$lib/server/crossover/dungeonMaster";
import { generateNPC } from "$lib/server/crossover/npc";
import { initializeClients } from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { npcs } from "$lib/server/crossover/settings/npc";
import { beforeAll, describe, expect, test } from "vitest";
import { createGandalfSarumanSauron, generateRandomGeohash } from "./utils";

let region: string;
let geohash: string;

let playerOne: Player;
let playerOneCookies: string;
let playerOneStream: EventTarget;
let playerTwo: Player;
let playerTwoCookies: string;
let playerTwoStream: EventTarget;
let playerThree: Player;
let playerThreeCookies: string;
let playerThreeStream: EventTarget;

let woodendoor: Item;
let woodenclub: Item;
let woodenclub2: Item;
let woodenclub3: Item;
let portal: Item;
let dragon: Monster;
let goblin: Monster;

// NPC
let npc: Player;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Create players
    ({
        region,
        geohash,
        playerOne,
        playerOneCookies,
        playerOneStream,
        playerTwo,
        playerTwoCookies,
        playerTwoStream,
        playerThree,
        playerThreeCookies,
        playerThreeStream,
    } = await createGandalfSarumanSauron());

    // Spawn items
    woodendoor = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables.doorsign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    woodenclub = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    woodenclub2 = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    woodenclub3 = (await spawnItemAtGeohash({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    portal = (await spawnItemAtGeohash({
        geohash: playerOne.loc[0],
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.portal.prop,
    })) as ItemEntity;

    // Spawn Monsters
    dragon = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        beast: "dragon",
        locationInstance: LOCATION_INSTANCE,
    });

    goblin = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        locationType: "geohash",
        beast: "goblin",
        locationInstance: LOCATION_INSTANCE,
    });

    // Spawn NPCs
    npc = await generateNPC(npcs.blacksmith.npc, {
        demographic: {},
        appearance: {},
    });
});

describe("Skills Tests", () => {
    test("Test `skillLevelProgression`", async () => {
        expect(skillLevelProgression(0)).toBe(0);
        expect(skillLevelProgression(1)).toBe(100);
        expect(skillLevelProgression(20)).toBe(355000);
        expect(skillLevelProgression(50)).toBe(3355000);
    });

    test("Test `learningDialoguesForSkill`", async () => {
        expect(learningDialoguesForSkill("exploration", 2)).toMatchObject([
            "${teacher.name} hands you a worn map and a compass.",
            "'The world is vast and full of wonders, ${player.name},' ${teacher.name} says with a glint in their eye.",
            "You learn to read the map and orient yourself using the compass.",
            "A sense of excitement builds as you realize how much there is to discover.",
            "'Remember, the journey is as important as the destination,' ${teacher.name} advises.",
        ]);
        expect(learningDialoguesForSkill("exploration", 10)).toMatchObject([
            "${teacher.name} takes you to a shimmering portal pulsing with arcane energy.",
            "'Your final lesson is about exploring the impossible, ${player.name},' ${teacher.name} says excitedly.",
            "You step through the portal, experiencing different planes of existence.",
            "Reality bends around you, but your training keeps you grounded and observant.",
            "Returning, ${teacher.name} grins, 'The world is yours to explore, brave adventurer.'",
        ]);
        expect(learningDialoguesForSkill("exploration", 20)).toMatchObject([
            "${teacher.name} takes you to a shimmering portal pulsing with arcane energy.",
            "'Your final lesson is about exploring the impossible, ${player.name},' ${teacher.name} says excitedly.",
            "You step through the portal, experiencing different planes of existence.",
            "Reality bends around you, but your training keeps you grounded and observant.",
            "Returning, ${teacher.name} grins, 'The world is yours to explore, brave adventurer.'",
        ]);
    });
});
