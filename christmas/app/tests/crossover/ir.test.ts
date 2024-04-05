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
        entities: {
            monsters: [],
            players: [
                {
                    name: "Gandalf",
                },
            ],
            items: [],
        },
        entityTokenPositions: {
            [playerOne.player]: {
                "0": {
                    token: "Gandalf",
                    score: 1,
                },
            },
        },
    });
    expect(
        entitiesInfomationRetrieval(tokenize("Saruman"), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        entities: {
            monsters: [],
            players: [
                {
                    name: "Saruman",
                },
            ],
            items: [],
        },
        entityTokenPositions: {
            [playerTwo.player]: {
                "0": {
                    token: "Saruman",
                    score: 1,
                },
            },
        },
    });

    // Search player by player id
    expect(
        entitiesInfomationRetrieval(tokenize(playerOne.player), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        entities: {
            monsters: [],
            players: [
                {
                    player: playerOne.player,
                },
            ],
            items: [],
        },
        entityTokenPositions: {
            [playerOne.player]: {
                "0": {
                    token: playerOne.player,
                    score: 1,
                },
            },
        },
    });

    // Search item by name
    expect(
        entitiesInfomationRetrieval(tokenize(woodenClub.name), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        entities: {
            monsters: [],
            players: [],
            items: [
                {
                    name: woodenClub.name,
                },
            ],
        },
        entityTokenPositions: {
            [woodenClub.item]: {
                "0": {
                    token: "Wooden",
                    score: 1,
                },
                "1": {
                    token: "Club",
                    score: 1,
                },
            },
        },
    });

    // Search item by item id
    expect(
        entitiesInfomationRetrieval(tokenize(woodenDoor.item), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        entities: {
            monsters: [],
            players: [],
            items: [
                {
                    item: woodenDoor.item,
                },
            ],
        },
        entityTokenPositions: {
            [woodenDoor.item]: {
                "0": {
                    token: woodenDoor.item,
                    score: 1,
                },
            },
        },
    });

    // Search monster by name
    expect(
        entitiesInfomationRetrieval(tokenize(dragon.name), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        entities: {
            monsters: [
                {
                    name: dragon.name,
                },
            ],
            players: [],
            items: [],
        },
        entityTokenPositions: {
            [dragon.monster]: {
                "0": {
                    token: dragon.name,
                    score: 1,
                },
            },
        },
    });

    // Search monster by monster id
    expect(
        entitiesInfomationRetrieval(tokenize(goblin.monster), {
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodenDoor, woodenClub],
        }),
    ).to.toMatchObject({
        entities: {
            monsters: [
                {
                    monster: goblin.monster,
                },
            ],
            players: [],
            items: [],
        },
        entityTokenPositions: {
            [goblin.monster]: {
                "0": {
                    token: goblin.monster,
                    score: 1,
                },
            },
        },
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
        entities: {
            monsters: [],
            players: [
                {
                    name: "Gandalf",
                },
            ],
            items: [],
        },
        entityTokenPositions: {
            [playerOne.player]: {
                "0": {
                    token: "Gandaf",
                    score: 0.8,
                },
            },
        },
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
        entities: {
            monsters: [],
            players: [],
            items: [],
        },
        entityTokenPositions: {},
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
        entities: {
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
        },
        entityTokenPositions: {
            [goblin.monster]: {
                "2": {
                    token: "gobli",
                    score: 0.8,
                },
            },
            [playerOne.player]: {
                "0": {
                    token: "Gandaf",
                    score: 0.8,
                },
            },
        },
    });
});
