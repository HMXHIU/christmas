import { entitiesInfomationRetrieval, tokenize } from "$lib/crossover/ir";
import { compendium } from "$lib/crossover/world/settings";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import type { ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test IR", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Player - playerOne
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(8);
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Player - playerTwo
    const playerTwoName = "Saruman";
    const playerTwoGeohash = generateRandomGeohash(8);
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });

    // Item - woodenDoor
    let woodenDoor = (await spawnItem({
        geohash: generateRandomGeohash(8),
        prop: compendium.woodenDoor.prop,
        variables: {
            [compendium.woodenDoor.variables!.doorSign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    // Item - woodenClub
    let woodenClub = await spawnItem({
        geohash: generateRandomGeohash(8),
        prop: compendium.woodenClub.prop,
    });

    // Monster - dragon
    let dragon = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        beast: "dragon",
        level: 1,
    });

    // Monster - goblin
    let goblin = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        beast: "goblin",
        level: 1,
    });

    /**
     * Test exact match
     */

    // Search player by name
    expect(
        entitiesInfomationRetrieval(tokenize("Gandalf"), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [
            {
                name: "Gandalf",
            },
        ],
        items: [],
    });
    expect(
        entitiesInfomationRetrieval(tokenize("Saruman"), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [
            {
                name: "Saruman",
            },
        ],
        items: [],
    });

    // Search player by player id
    expect(
        entitiesInfomationRetrieval(tokenize(playerOne.player), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [
            {
                player: playerOne.player,
            },
        ],
        items: [],
    });

    // Search item by name
    expect(
        entitiesInfomationRetrieval(tokenize(woodenClub.name), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [],
        items: [
            {
                name: woodenClub.name,
            },
        ],
    });

    // Search item by item id
    expect(
        entitiesInfomationRetrieval(tokenize(woodenDoor.item), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [],
        items: [
            {
                item: woodenDoor.item,
            },
        ],
    });

    // Search monster by name
    expect(
        entitiesInfomationRetrieval(tokenize(dragon.name), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        monsters: [
            {
                name: dragon.name,
            },
        ],
        players: [],
        items: [],
    });

    // Search monster by monster id
    expect(
        entitiesInfomationRetrieval(tokenize(goblin.monster), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        monsters: [
            {
                monster: goblin.monster,
            },
        ],
        players: [],
        items: [],
    });

    /**
     * Test search by partial match
     */
    expect(
        entitiesInfomationRetrieval(tokenize("Gandaf"), {
            // subtracted one letter
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [
            {
                name: "Gandalf",
            },
        ],
        items: [],
    });
    expect(
        entitiesInfomationRetrieval(tokenize("Gan"), {
            // to much error
            // subtracted one letter
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [],
        items: [],
    });

    /**
     * Test search multiple entities
     */
    expect(
        entitiesInfomationRetrieval(tokenize("Gandaf attacks gobli"), {
            // subtracted one letter
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        monsters: [
            {
                monster: goblin.monster,
            },
        ],
        players: [
            {
                name: "Gandalf",
            },
        ],
        items: [],
    });
});
