import {
    entitiesIR,
    fuzzyMatch,
    gameActionsIR,
    tokenize,
} from "$lib/crossover/ir";
import { abilities, type Ability } from "$lib/crossover/world/abilities";
import type { Utility } from "$lib/crossover/world/compendium";
import { compendium } from "$lib/crossover/world/compendium";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import type { Item, ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test IR", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Player - playerOne
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(8, "h9");
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Player - playerTwo
    const playerTwoName = "Saruman";
    const playerTwoGeohash = generateRandomGeohash(8, "h9");
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });

    // Item - woodendoor
    let woodendoor = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables!.doorsign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    // Item - woodenclub
    let woodenclub = await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenclub.prop,
    });

    // Item - portal
    let portal = (await spawnItem({
        geohash: playerOneGeohash,
        prop: compendium.portal.prop,
    })) as ItemEntity;

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
     * Test `fuzzyMatch`
     */

    expect(fuzzyMatch("Gandalf", "Gandalf", 1)).toBe(true);
    expect(fuzzyMatch("bandage", "gandalf", 1)).toBe(false);
    expect(fuzzyMatch("bandage", "gandalf", 3)).toBe(true);

    /**
     * Test exact match `entitiesIR`
     */

    // Search player by name
    expect(
        entitiesIR({
            queryTokens: tokenize("Gandalf"),
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodendoor, woodenclub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [
            {
                name: "Gandalf",
            },
        ],
        items: [],
        tokenPositions: {
            [playerOne.player]: {
                "0": {
                    token: "gandalf",
                    score: 1,
                },
            },
        },
    });
    expect(
        entitiesIR({
            queryTokens: tokenize("Saruman"),
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodendoor, woodenclub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [
            {
                name: "Saruman",
            },
        ],
        items: [],
        tokenPositions: {
            [playerTwo.player]: {
                "0": {
                    token: "saruman",
                    score: 1,
                },
            },
        },
    });

    // Search player by player id
    expect(
        entitiesIR({
            queryTokens: tokenize(playerOne.player),
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodendoor, woodenclub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [
            {
                player: playerOne.player,
            },
        ],
        items: [],
        tokenPositions: {
            [playerOne.player]: {
                "0": {
                    token: playerOne.player.toLocaleLowerCase(),
                    score: 1,
                },
            },
        },
    });

    // Search item by name
    expect(
        entitiesIR({
            queryTokens: tokenize(woodenclub.name),
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodendoor, woodenclub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [],
        items: [
            {
                name: woodenclub.name,
            },
        ],
        tokenPositions: {
            [woodenclub.item]: {
                "0": {
                    token: "wooden",
                    score: 1,
                },
                "1": {
                    token: "club",
                    score: 1,
                },
            },
        },
    });

    // Search item by item id
    expect(
        entitiesIR({
            queryTokens: tokenize(woodendoor.item),
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodendoor, woodenclub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [],
        items: [
            {
                item: woodendoor.item,
            },
        ],
        tokenPositions: {
            [woodendoor.item]: {
                "0": {
                    token: woodendoor.item.toLocaleLowerCase(),
                    score: 1,
                },
            },
        },
    });

    // Search monster by name
    expect(
        entitiesIR({
            queryTokens: tokenize(dragon.name),
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodendoor, woodenclub],
        }),
    ).to.toMatchObject({
        monsters: [
            {
                name: dragon.name,
            },
        ],
        players: [],
        items: [],
        tokenPositions: {
            [dragon.monster]: {
                "0": {
                    token: dragon.name.toLocaleLowerCase(),
                    score: 1,
                },
            },
        },
    });

    // Search monster by monster id
    expect(
        entitiesIR({
            queryTokens: tokenize(goblin.monster),
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodendoor, woodenclub],
        }),
    ).to.toMatchObject({
        monsters: [
            {
                monster: goblin.monster,
            },
        ],
        players: [],
        items: [],
        tokenPositions: {
            [goblin.monster]: {
                "0": {
                    token: goblin.monster.toLocaleLowerCase(),
                    score: 1,
                },
            },
        },
    });

    /**
     * Test search by partial match `entitiesIR`
     */
    expect(
        entitiesIR({
            queryTokens: tokenize("Gandaf"), // subtracted one letter
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodendoor, woodenclub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [
            {
                name: "Gandalf",
            },
        ],
        items: [],
        tokenPositions: {
            [playerOne.player]: {
                "0": {
                    token: "gandaf",
                    score: 0.8,
                },
            },
        },
    });

    expect(
        entitiesIR({
            queryTokens: tokenize("Gan"), // subtracted one letter
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodendoor, woodenclub],
        }),
    ).to.toMatchObject({
        monsters: [],
        players: [], // to much error
        items: [],
        tokenPositions: {},
    });

    /**
     * Test search multiple entities `entitiesIR`
     */
    expect(
        entitiesIR({
            // subtracted one letter
            queryTokens: tokenize("Gandaf attacks gobli"),
            monsters: [dragon, goblin],
            players: [playerOne, playerTwo],
            items: [woodendoor, woodenclub],
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
        tokenPositions: {
            [goblin.monster]: {
                "2": {
                    token: "gobli",
                    score: 0.8,
                },
            },
            [playerOne.player]: {
                "0": {
                    token: "gandaf",
                    score: 0.8,
                },
            },
        },
    });

    /**
     * Test exact match `gameActionsIR`
     */

    const itemUtilities: [Item, Utility][] = [
        woodenclub,
        woodendoor,
        portal,
    ].flatMap((item) => {
        return Object.values(compendium[item.prop].utilities).map(
            (utility): [Item, Utility] => {
                return [item, utility];
            },
        );
    });
    const playerAbilities: Ability[] = Object.values(abilities);

    // Test action
    expect(
        gameActionsIR({
            queryTokens: tokenize("open woodendoor"),
            abilities: playerAbilities,
            itemUtilities,
            actions: [],
        }),
    ).to.toMatchObject({
        abilities: [],
        itemUtilities: [
            [
                {
                    item: woodendoor.item,
                },
                {
                    utility: "open",
                    description: "Open the door.",
                },
            ],
        ],
        tokenPositions: {
            open: {
                "0": {
                    token: "open",
                    score: 1,
                },
            },
        },
    });

    // Test ability
    expect(
        gameActionsIR({
            queryTokens: tokenize("eyepok goblin"), // subtracted one letter
            abilities: playerAbilities,
            itemUtilities,
            actions: [],
        }),
    ).to.toMatchObject({
        abilities: [
            {
                ability: "eyePoke",
                type: "offensive",
                description: "Pokes the player's eyes, blinding them.",
            },
        ],
        itemUtilities: [],
        tokenPositions: {
            eyePoke: {
                "0": {
                    token: "eyepok",
                    score: 0.8,
                },
            },
        },
    });

    // Test token exists in abilities and actions
    expect(
        gameActionsIR({
            queryTokens: tokenize("teleport to player"),
            abilities: playerAbilities,
            itemUtilities,
            actions: [],
        }),
    ).to.toMatchObject({
        abilities: [
            {
                ability: "teleport",
                description: "Teleport to the target location.",
            },
        ],
        itemUtilities: [
            [
                {
                    item: portal.item,
                },
                {
                    utility: "teleport",
                    description: "Step through the portal.",
                    ability: "teleport",
                },
            ],
        ],
        tokenPositions: {
            teleport: {
                "0": {
                    token: "teleport",
                    score: 1,
                },
            },
        },
    });
});
