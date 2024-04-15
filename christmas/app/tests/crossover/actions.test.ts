import { commandVariables } from "$lib/crossover";
import { actions } from "$lib/crossover/actions";
import { searchPossibleCommands } from "$lib/crossover/ir";
import { abilities, compendium } from "$lib/crossover/world/settings";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import type { ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test Actions", async () => {
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
            [compendium.woodendoor.variables.doorSign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    // Wooden club
    let woodenclub = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    // Portal
    let portal = (await spawnItem({
        geohash: playerOne.location[0], // spawn at playerOne
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
     * Test `commandVariables`
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

    var variables = commandVariables({
        command: commands[0],
        queryTokens,
        tokenPositions,
    });

    expect(variables).toMatchObject({
        query: "say saruman thou shall not pass",
        queryIrrelevant: "thou shall not pass",
    });
});
