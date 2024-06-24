import { searchPossibleCommands } from "$lib/crossover/ir";
import { abilities } from "$lib/crossover/world/abilities";
import { actions } from "$lib/crossover/world/actions";
import { compendium } from "$lib/crossover/world/compendium";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import { initializeClients } from "$lib/server/crossover/redis";
import type { ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test Actions", async () => {
    await initializeClients(); // create redis repositories

    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(8, "h9");
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = playerOneGeohash;
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });

    // Wooden Door
    let woodendoor = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables.doorsign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    // Wooden club
    let woodenclub = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;
    let woodenclub2 = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;
    let woodenclub3 = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    // Portal
    let portal = (await spawnItem({
        geohash: playerOne.loc[0], // spawn at playerOne
        prop: compendium.portal.prop,
    })) as ItemEntity;

    // Dragon
    let dragon = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        beast: "dragon",
        level: 1,
    });

    // Goblin
    let goblin = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        beast: "goblin",
        level: 1,
    });

    /**
     * Test positive case
     */

    var commands = searchPossibleCommands({
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
                description: "Look at the surroundings.",
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

    // Test optional target
    commands = searchPossibleCommands({
        query: "look goblin",
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
                query: "look goblin",
                queryIrrelevant: "",
            },
        ],
    ]);

    /**
     * Test negative case
     */

    commands = searchPossibleCommands({
        query: "rejected look", // token position must be 0
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

    /**
     * Test GameCommandVariables
     */

    var { queryTokens, tokenPositions, commands } = searchPossibleCommands({
        query: "say saruman thou shall not pass",
        player: playerOne,
        actions: [actions.look, actions.say],
        playerAbilities: [abilities.scratch],
        playerItems: [woodenclub],
        monsters: [dragon],
        players: [playerTwo],
        items: [woodendoor, woodenclub, portal],
    });
    const [action, entities, variables] = commands[0];
    expect(variables).toMatchObject({
        query: "say saruman thou shall not pass",
        queryIrrelevant: "thou shall not pass",
    });

    /**
     * Test can only drop items in inventory
     */

    woodenclub2.locT = "inv";
    woodenclub2.loc = [playerOne.player];
    commands = searchPossibleCommands({
        query: `drop ${woodenclub3.item}`,
        player: playerOne,
        actions: [actions.drop],
        playerAbilities: [],
        playerItems: [woodenclub2],
        monsters: [],
        players: [],
        items: [woodenclub3, woodenclub],
    }).commands;
    expect(commands).length(1);
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
