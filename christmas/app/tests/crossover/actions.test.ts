import { crossoverCmdLearn, crossoverCmdSay } from "$lib/crossover/client";
import { searchPossibleCommands } from "$lib/crossover/ir";
import { actions } from "$lib/crossover/world/actions";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
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
import {
    fetchEntity,
    initializeClients,
    saveEntity,
} from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { npcs } from "$lib/server/crossover/settings/npc";
import { sleep } from "$lib/utils";
import { beforeAll, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    generateRandomGeohash,
    waitForEventData,
} from "./utils";

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
    test("`learn` from NPC", async () => {
        npc.loc = playerOne.loc;
        npc.locI = playerOne.locI;
        npc.locT = playerOne.locT;
        npc = (await saveEntity(npc as PlayerEntity)) as PlayerEntity;

        // Test teacher not enough skill
        crossoverCmdLearn(
            { skill: "exploration", teacher: npc.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: npc.player,
                name: "Blacksmith",
                message:
                    "Blacksmith furrows his brow. 'This skill lies beyond even my grasp. Seek out one more learned than I.'",
            },
            event: "feed",
        });

        // Test player not enough learning resources
        npc.skills["exploration"] = 10;
        npc = (await saveEntity(npc as PlayerEntity)) as PlayerEntity;
        crossoverCmdLearn(
            { skill: "exploration", teacher: npc.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: npc.player,
                name: "Blacksmith",
                message:
                    "Despite your best efforts, the skill eludes you, perhaps with more experience.",
            },
            event: "feed",
        });

        // Test able to learn
        playerOne.lum = 1000;
        playerOne = (await saveEntity(
            playerOne as PlayerEntity,
        )) as PlayerEntity;
        const curSkillLevel = playerOne.skills?.exploration ?? 0;
        crossoverCmdLearn(
            { skill: "exploration", teacher: npc.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerOneStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${message}",
            variables: {
                cmd: "say",
                player: npc.player,
                name: "Blacksmith",
                message: learningDialoguesForSkill(
                    "exploration",
                    curSkillLevel + 1,
                )[0],
            },
            event: "feed",
        });
        await sleep(actions.learn.ticks * MS_PER_TICK * 2);

        // Check skill level and resources
        const playerOneAfter = (await fetchEntity(
            playerOne.player,
        )) as PlayerEntity;
        expect(playerOneAfter).toMatchObject({
            skills: {
                exploration: curSkillLevel + 1,
            },
            lum: playerOne.lum - skillLevelProgression(curSkillLevel),
        });
    });

    test("`say` to specific `target`", async () => {
        // `playerOne` says hello to `playerTwo`
        crossoverCmdSay(
            { message: "hello", target: playerTwo.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerTwoStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: playerOne.name,
                message: "hello",
            },
            event: "feed",
        });
        await sleep(MS_PER_TICK * 2);

        // `playerOne` says hello to `playerTwo`, `playerThree` should not get message
        crossoverCmdSay(
            { message: "hello", target: playerTwo.player },
            { Cookie: playerOneCookies },
        );
        await expect(
            waitForEventData(playerThreeStream, "feed"),
        ).rejects.toThrowError("Timeout occurred while waiting for event");
        await sleep(MS_PER_TICK * 2);

        // `playerOne` says to everyone
        crossoverCmdSay({ message: "hello" }, { Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerTwoStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: playerOne.name,
                message: "hello",
            },
            event: "feed",
        });
        await expect(
            waitForEventData(playerThreeStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: playerOne.name,
                message: "hello",
            },
            event: "feed",
        });
    });
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
        }).commands;

        expect(commands.length).toBe(0);
        expect(commands).toMatchObject([]);
    });

    test("Say action with message", () => {
        const { commands } = searchPossibleCommands({
            query: "say saruman thou shall not pass",
            player: playerOne,
            actions: [actions.look, actions.say],
            playerAbilities: [abilities.scratch],
            playerItems: [woodenclub],
            monsters: [dragon],
            players: [playerTwo],
            items: [woodendoor, woodenclub, portal],
        });

        const [, , variables] = commands[0];
        expect(variables).toMatchObject({
            query: "say saruman thou shall not pass",
            queryIrrelevant: "thou shall not pass",
        });
    });

    test("Drop action only for inventory items", () => {
        woodenclub2.locT = "inv";
        woodenclub2.loc = [playerOne.player];

        const commands = searchPossibleCommands({
            query: `drop ${woodenclub3.item}`,
            player: playerOne,
            actions: [actions.drop],
            playerAbilities: [],
            playerItems: [woodenclub2],
            monsters: [],
            players: [],
            items: [woodenclub3, woodenclub],
        }).commands;

        expect(commands).toHaveLength(1);
        expect(commands).toMatchObject([
            [
                {
                    action: "drop",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: woodenclub2.item,
                    },
                },
                {
                    query: `drop ${woodenclub3.item}`,
                    queryIrrelevant: "",
                },
            ],
        ]);
    });
});
