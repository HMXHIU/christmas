import { searchPossibleCommands } from "$lib/crossover/ir";
import { abilities } from "$lib/crossover/world/abilities";
import { actions } from "$lib/crossover/world/actions";
import { compendium } from "$lib/crossover/world/compendium";
import { spawnItem, spawnMonster } from "$lib/server/crossover/dungeonMaster";
import { initializeClients, saveEntity } from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
} from "$lib/server/crossover/redis/entities";
import { beforeAll, describe, expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

const region = String.fromCharCode(...getRandomRegion());

let playerOne: Player;
let playerTwo: Player;
let woodendoor: Item;
let woodenclub: Item;
let woodenclub2: Item;
let woodenclub3: Item;
let portal: Item;
let dragon: Monster;
let goblin: Monster;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Player one
    const playerOneGeohash = generateRandomGeohash(8, "h9");
    [, , playerOne] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: "Gandalf",
    });

    // Player two
    [, , playerTwo] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: "Saruman",
    });

    // Spawn items
    woodendoor = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables.doorsign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    woodenclub = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    woodenclub2 = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    woodenclub3 = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    portal = (await spawnItem({
        geohash: playerOne.loc[0],
        prop: compendium.portal.prop,
    })) as ItemEntity;

    // Spawn Monsters
    dragon = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        beast: "dragon",
        level: 1,
    });

    goblin = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        beast: "goblin",
        level: 1,
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
