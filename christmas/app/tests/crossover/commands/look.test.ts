import { searchPossibleCommands } from "$lib/crossover/ir";
import { actions } from "$lib/crossover/world/actions";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import {
    spawnItemAtGeohash,
    spawnMonster,
} from "$lib/server/crossover/dungeonMaster";
import { generateNPC } from "$lib/server/crossover/npc";
import { initializeClients, saveEntity } from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
} from "$lib/server/crossover/redis/entities";
import { npcs } from "$lib/server/crossover/settings/npc";
import { beforeAll, describe, expect, test } from "vitest";
import { createGandalfSarumanSauron, generateRandomGeohash } from "../utils";

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

describe("Actions Tests", () => {
    test("Look action without target", () => {
        const commands = searchPossibleCommands({
            query: "look",
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.scratch],
            playerItems: [woodenclub],
            monsters: [dragon],
            players: [playerTwo],
            items: [woodendoor, woodenclub, portal],
            skills: [...SkillLinesEnum],
        }).commands;

        expect(commands).toMatchObject([
            [
                {
                    action: "look",
                    description: actions.look.description,
                    predicate: {
                        target: ["player", "monster", "item", "none"],
                        tokenPositions: {
                            action: 0,
                            target: 1,
                        },
                    },
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                },
                {
                    query: "look",
                    queryIrrelevant: "",
                },
            ],
        ]);
    });

    test("Look action with target", async () => {
        goblin.loc = [playerOne.loc[0]];
        dragon.loc = [playerOne.loc[0]];
        goblin = (await saveEntity(goblin as MonsterEntity)) as Monster;
        dragon = (await saveEntity(dragon as MonsterEntity)) as Monster;

        const commands = searchPossibleCommands({
            query: `look ${goblin.monster}`,
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.scratch],
            playerItems: [woodenclub],
            monsters: [dragon, goblin],
            players: [playerTwo],
            items: [woodendoor, woodenclub, portal],
            skills: [...SkillLinesEnum],
        }).commands;

        expect(commands).toMatchObject([
            [
                {
                    action: "look",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        monster: goblin.monster,
                    },
                },
                {
                    query: `look ${goblin.monster}`,
                    queryIrrelevant: "",
                },
            ],
        ]);
    });

    test("Invalid action (wrong token position)", () => {
        const commands = searchPossibleCommands({
            query: "rejected look",
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.scratch],
            playerItems: [woodenclub],
            monsters: [dragon],
            players: [playerTwo],
            items: [woodendoor, woodenclub, portal],
            skills: [...SkillLinesEnum],
        }).commands;

        expect(commands.length).toBe(0);
        expect(commands).toMatchObject([]);
    });
});
