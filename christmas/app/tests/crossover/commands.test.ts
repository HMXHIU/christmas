import {
    crossoverCmdEquip,
    crossoverCmdTake,
    executeGameCommand,
    stream,
} from "$lib/crossover";
import { searchPossibleCommands, type GameCommand } from "$lib/crossover/ir";
import { geohashNeighbour } from "$lib/crossover/utils";
import { abilities } from "$lib/crossover/world/abilities";
import { compendium } from "$lib/crossover/world/compendium";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import type { ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import {
    createRandomPlayer,
    generateRandomGeohash,
    waitForEventData,
} from "./utils";

test("Test Commands", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Create Players
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(8, "h9");
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });
    const playerTwoName = "Saruman";
    const playerTwoGeohash = playerOneGeohash;
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerTwoName,
        });

    // Create streams
    const [eventStreamOne, closeStreamOne] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(eventStreamOne, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    const [eventStreamTwo, closeStreamTwo] = await stream({
        Cookie: playerTwoCookies,
    });
    await expect(
        waitForEventData(eventStreamTwo, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // Wooden Door
    let woodendoor = (await spawnItem({
        geohash: geohashNeighbour(playerOneGeohash, "n"),
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables.doorsign.variable]:
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
        geohash: playerOne.loc[0], // spawn at playerOne
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

    setTimeout(async () => {
        executeGameCommand(openDoor, { Cookie: playerOneCookies });
    }, 0);

    var openDoorResult = await waitForEventData(eventStreamOne, "entities");
    expect(openDoorResult).toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: woodendoor.item,
                state: "closed",
            },
        ],
    });

    openDoorResult = await waitForEventData(eventStreamOne, "entities");
    expect(openDoorResult).toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: woodendoor.item,
                state: "open",
            },
        ],
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

    setTimeout(async () => {
        executeGameCommand(closeDoor, { Cookie: playerOneCookies });
    }, 0);

    var closeDoorResult = await waitForEventData(eventStreamOne, "entities");
    expect(closeDoorResult).toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: woodendoor.item,
                state: "open",
            },
        ],
    });

    closeDoorResult = await waitForEventData(eventStreamOne, "entities");
    expect(closeDoorResult).toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: woodendoor.item,
                state: "closed",
            },
        ],
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

    setTimeout(async () => {
        executeGameCommand(scratchGoblin, { Cookie: playerOneCookies });
    }, 0);

    var scratchResult = await waitForEventData(eventStreamOne, "entities");
    expect(scratchResult).toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                st: 9,
                ap: 3,
            },
        ],
        monsters: [],
        items: [],
    });
    var scratchResult = await waitForEventData(eventStreamOne, "entities");
    expect(scratchResult).toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                st: 9, // -1
                ap: 3, // -1
            },
        ],
        monsters: [
            {
                monster: goblin.monster,
                hp: 19, // -1
                mp: 20,
                st: 20,
                ap: 11,
            },
        ],
        items: [],
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

    setTimeout(async () => {
        executeGameCommand(swingGoblin, { Cookie: playerOneCookies });
    }, 0);

    var swingResult = await waitForEventData(eventStreamOne, "entities");
    expect(swingResult).toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: woodenclub.item,
                dur: 100,
                chg: 0,
                state: "default",
            },
        ],
    });

    swingResult = await waitForEventData(eventStreamOne, "entities");
    expect(swingResult).toMatchObject({
        event: "entities",
        players: [
            {
                player: playerOne.player,
                hp: 10,
                mp: 10,
                st: 9,
            },
        ],
        monsters: [
            {
                monster: goblin.monster,
                hp: 18, // -1
            },
        ],
        items: [],
    });
    swingResult = await waitForEventData(eventStreamOne, "entities");
    expect(swingResult).toMatchObject({
        event: "entities",
        players: [],
        monsters: [],
        items: [
            {
                item: woodenclub.item,
                dur: 99, // -1
                chg: 0,
                state: "default",
            },
        ],
    });
});
