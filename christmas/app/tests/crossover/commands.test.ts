import {
    crossoverCmdEquip,
    crossoverCmdTake,
    executeGameCommand,
} from "$lib/crossover";
import { searchPossibleCommands, type GameCommand } from "$lib/crossover/ir";
import { geohashNeighbour } from "$lib/crossover/utils";
import { abilities, compendium } from "$lib/crossover/world/settings";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import type { ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test Player", async () => {
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
            geohash: playerOneGeohash,
            name: playerTwoName,
        });

    // Wooden Door
    let woodendoor = (await spawnItem({
        geohash: geohashNeighbour(playerOneGeohash, "n"),
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables.doorSign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    // Wooden club
    let woodenclub = (await spawnItem({
        geohash: playerOneGeohash,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    // Portal
    let portal = (await spawnItem({
        geohash: playerOne.location[0], // spawn at playerOne
        prop: compendium.portal.prop,
    })) as ItemEntity;

    // Dragon
    let dragon = await spawnMonster({
        geohash: geohashNeighbour(geohashNeighbour(playerOneGeohash, "s"), "s"),
        beast: "dragon",
        level: 1,
    });

    // Goblin
    let goblin = await spawnMonster({
        geohash: playerOneGeohash,
        beast: "goblin",
        level: 1,
    });

    /**
     * Test open/close door
     */

    const openDoor: GameCommand = searchPossibleCommands({
        query: "open woodendoor",
        // Player
        player: playerOne,
        playerAbilities: [
            abilities.scratch,
            abilities.bandage,
            abilities.swing,
        ],
        playerItems: [woodenclub],
        actions: [],
        // Environment
        monsters: [goblin, dragon],
        players: [playerOne],
        items: [woodendoor],
    }).commands[0];

    await expect(
        executeGameCommand(openDoor, { Cookie: playerOneCookies }),
    ).resolves.toMatchObject({
        items: [
            {
                item: woodendoor.item,
                durability: 100,
                charges: 0,
                state: "open",
                variables: {
                    doorSign: "A custom door sign",
                },
                debuffs: [],
                buffs: [],
            },
        ],
        players: [
            {
                player: playerOne.player,
            },
        ],
        monsters: [],
        status: "success",
        message: "",
        op: "upsert",
    });

    const closeDoor: GameCommand = searchPossibleCommands({
        query: "close woodendoor",
        // Player
        player: playerOne,
        playerAbilities: [
            abilities.scratch,
            abilities.bandage,
            abilities.swing,
        ],
        playerItems: [woodenclub],
        actions: [],
        // Environment
        monsters: [goblin, dragon],
        players: [playerOne],
        items: [woodendoor],
    }).commands[0];

    await expect(
        executeGameCommand(closeDoor, { Cookie: playerOneCookies }),
    ).resolves.toMatchObject({
        items: [
            {
                item: woodendoor.item,
                durability: 100,
                charges: 0,
                state: "closed",
                variables: {
                    doorSign: "A custom door sign",
                },
                debuffs: [],
                buffs: [],
            },
        ],
        players: [
            {
                player: playerOne.player,
            },
        ],
        monsters: [],
        status: "success",
        message: "",
        op: "upsert",
    });

    /**
     * Test ability on monster
     */

    const scratchGoblin: GameCommand = searchPossibleCommands({
        query: "scratch goblin",
        // Player
        player: playerOne,
        playerAbilities: [
            abilities.scratch,
            abilities.bandage,
            abilities.swing,
        ],
        playerItems: [woodenclub],
        actions: [],
        // Environment
        monsters: [goblin, dragon],
        players: [playerOne],
        items: [woodendoor],
    }).commands[0];

    await expect(
        executeGameCommand(scratchGoblin, { Cookie: playerOneCookies }),
    ).resolves.toMatchObject({
        players: [
            {
                player: playerOne.player,
                st: 9,
                ap: 9,
            },
        ],
        monsters: [
            {
                monster: goblin.monster,
                hp: 19,
            },
        ],
        op: "upsert",
        status: "success",
    });

    /**
     * Test utility on monster
     */

    // Take wooden club
    await crossoverCmdTake(
        { item: woodenclub.item },
        { Cookie: playerOneCookies },
    );

    // Equip wooden club
    await crossoverCmdEquip(
        {
            item: woodenclub.item,
            slot: "rh",
        },
        { Cookie: playerOneCookies },
    );

    // Swing wooden club at goblin
    const swingGoblin: GameCommand = searchPossibleCommands({
        query: "swing goblin",
        // Player
        player: playerOne,
        playerAbilities: [abilities.scratch, abilities.bandage],
        playerItems: [woodenclub],
        actions: [],
        // Environment
        monsters: [goblin, dragon],
        players: [playerOne],
        items: [woodendoor],
    }).commands[0];

    await expect(
        executeGameCommand(swingGoblin, { Cookie: playerOneCookies }),
    ).resolves.toMatchObject({
        items: [
            {
                item: woodenclub.item,
                location: [playerOne.player],
                locationType: "rh",
                durability: 99,
                charges: 0,
            },
        ],
        players: [
            {
                player: playerOne.player,
                st: 9,
                ap: 9,
            },
        ],
        monsters: [
            {
                monster: goblin.monster,
                hp: 18,
            },
        ],
        op: "upsert",
        status: "success",
        message: "",
    });
});
