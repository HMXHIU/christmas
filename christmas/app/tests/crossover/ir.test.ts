import { abilitiesActionsIR, entitiesIR, tokenize } from "$lib/crossover/ir";
import type { Ability } from "$lib/crossover/world/abilities";
import type { PropAction } from "$lib/crossover/world/compendium";
import { abilities, compendium } from "$lib/crossover/world/settings";
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
     * Test exact match `entitiesIR`
     */

    // Search player by name
    expect(
        entitiesIR({
            queryTokens: tokenize("Gandalf"),
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
        tokenPositions: {
            [playerOne.player]: {
                "0": {
                    token: "Gandalf",
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
        tokenPositions: {
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
        entitiesIR({
            queryTokens: tokenize(playerOne.player),
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
        tokenPositions: {
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
        entitiesIR({
            queryTokens: tokenize(woodenClub.name),
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
        tokenPositions: {
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
        entitiesIR({
            queryTokens: tokenize(woodenDoor.item),
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
        tokenPositions: {
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
        entitiesIR({
            queryTokens: tokenize(dragon.name),
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
        tokenPositions: {
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
        entitiesIR({
            queryTokens: tokenize(goblin.monster),
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
        tokenPositions: {
            [goblin.monster]: {
                "0": {
                    token: goblin.monster,
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
        tokenPositions: {
            [playerOne.player]: {
                "0": {
                    token: "Gandaf",
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
            items: [woodenDoor, woodenClub],
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
        tokenPositions: {
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

    /**
     * Test exact match `abilitiesActionsIR`
     */

    const playerActions: PropAction[] = Object.values(compendium).flatMap(
        (prop) => Object.values(prop.actions),
    );
    const playerAbilities: Ability[] = Object.values(abilities);

    // Test action
    expect(
        abilitiesActionsIR({
            queryTokens: tokenize("open woodendoor"),
            abilities: playerAbilities,
            actions: playerActions,
        }),
    ).to.toMatchObject({
        abilities: [],
        actions: [
            {
                action: "open",
                description: "Open the door.",
            },
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
        abilitiesActionsIR({
            queryTokens: tokenize("eyepok goblin"), // subtracted one letter
            abilities: playerAbilities,
            actions: playerActions,
        }),
    ).to.toMatchObject({
        abilities: [
            {
                ability: "eyePoke",
                type: "offensive",
                description: "Pokes the player's eyes, blinding them.",
            },
        ],
        actions: [],
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
        abilitiesActionsIR({
            queryTokens: tokenize("teleport to player"),
            abilities: playerAbilities,
            actions: playerActions,
        }),
    ).to.toMatchObject({
        abilities: [
            {
                ability: "teleport",
                description: "Teleport to the target location.",
            },
        ],
        actions: [
            {
                action: "teleport",
                description: "Step through the portal.",
            },
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
