import {
    entitiesIR,
    gameActionsIR,
    searchPossibleCommands,
    tokenize,
} from "$lib/crossover/ir";
import {
    resolveAbilityEntities,
    type Ability,
} from "$lib/crossover/world/abilities";
import type { Utility } from "$lib/crossover/world/compendium";
import { abilities, compendium } from "$lib/crossover/world/settings";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import type { Item, ItemEntity } from "$lib/server/crossover/redis/entities";
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
    const playerTwoGeohash = generateRandomGeohash(8, "h9");
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });

    // Player three
    const playerThreeName = "Sauron";
    const playerThreeGeohash = generateRandomGeohash(8, "h9");
    let [playerThreeWallet, playerThreeCookies, playerThree] =
        await createRandomPlayer({
            region,
            geohash: playerThreeGeohash,
            name: playerThreeName,
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

    // Actions & Abilities
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

    /**
     * Test query flow (player scratch goblin)
     */

    // Tokenize query
    let query = "scratch goblin";
    let queryTokens = tokenize(query);

    // Retrieve entities relevant to query from the environment
    var {
        monsters,
        players,
        items,
        tokenPositions: entityTokenPositions,
    } = entitiesIR({
        queryTokens,
        monsters: [dragon, goblin],
        players: [playerOne, playerTwo, playerThree],
        items: [woodendoor, woodenclub, portal],
    });

    // Retrieve actions and abilities relevant to query
    var {
        itemUtilities: itemUtilitiesPossible,
        abilities: abilitiesPossible,
        tokenPositions: abilityTokenPositions,
    } = gameActionsIR({
        queryTokens,
        abilities: playerAbilities,
        itemUtilities,
        actions: [],
    });

    // Resolve abilities relevant to retrieved entities (may have multiple resolutions - allow selection by user)
    let abilityEntities = abilitiesPossible
        .map((ability) => [
            ability,
            resolveAbilityEntities({
                queryTokens,
                tokenPositions: {
                    ...entityTokenPositions,
                    ...abilityTokenPositions,
                },
                ability: ability.ability,
                self: playerOne,
                monsters,
                players,
                items,
            }),
        ])
        .filter(([ability, entities]) => entities != null);
    expect(abilityEntities).to.toMatchObject([
        [
            {
                ability: "scratch",
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
     * Test query flow (dragon breathe fire on goblin)
     */

    // Tokenize query
    query = "breathFire on goblin";
    queryTokens = tokenize(query);

    // Retrieve entities relevant to query from the environment
    var {
        monsters,
        players,
        items,
        tokenPositions: entityTokenPositions,
    } = entitiesIR({
        queryTokens,
        monsters: [dragon, goblin],
        players: [playerOne, playerTwo, playerThree],
        items: [woodendoor, woodenclub, portal],
    });

    // Retrieve actions and abilities relevant to query
    var {
        itemUtilities: itemUtilitiesPossible,
        abilities: abilitiesPossible,
        tokenPositions: abilityTokenPositions,
    } = gameActionsIR({
        queryTokens,
        abilities: playerAbilities,
        itemUtilities,
        actions: [],
    });

    // Resolve abilities relevant to retrieved entities (may have multiple resolutions - allow selection by user)
    abilityEntities = abilitiesPossible
        .map((ability) => [
            ability,
            resolveAbilityEntities({
                queryTokens,
                tokenPositions: {
                    ...entityTokenPositions,
                    ...abilityTokenPositions,
                },
                ability: ability.ability,
                self: dragon, // self is dragon
                monsters,
                players,
                items,
            }),
        ])
        .filter(([ability, entities]) => entities != null);
    expect(abilityEntities).to.toMatchObject([
        [
            {
                ability: "breathFire",
            },
            {
                self: {
                    monster: dragon.monster,
                },
                target: {
                    monster: goblin.monster,
                },
            },
        ],
    ]);

    /**
     * Test query flow (playerOne bandage self)
     */

    // Tokenize query
    query = "bandage gandalf";
    queryTokens = tokenize(query);

    // Retrieve entities relevant to query from the environment
    var {
        monsters,
        players,
        items,
        tokenPositions: entityTokenPositions,
    } = entitiesIR({
        queryTokens,
        monsters: [dragon, goblin],
        players: [playerOne, playerTwo, playerThree],
        items: [woodendoor, woodenclub, portal],
    });

    // Retrieve actions and abilities relevant to query
    var {
        itemUtilities: itemUtilitiesPossible,
        abilities: abilitiesPossible,
        tokenPositions: abilityTokenPositions,
    } = gameActionsIR({
        queryTokens,
        abilities: playerAbilities,
        itemUtilities,
        actions: [],
    });

    // Resolve abilities relevant to retrieved entities (may have multiple resolutions - allow selection by user)
    abilityEntities = abilitiesPossible
        .map((ability) => [
            ability,
            resolveAbilityEntities({
                queryTokens,
                tokenPositions: {
                    ...entityTokenPositions,
                    ...abilityTokenPositions,
                },
                ability: ability.ability,
                self: playerOne,
                monsters,
                players,
                items,
            }),
        ])
        .filter(([ability, entities]) => entities != null);
    expect(abilityEntities).to.toMatchObject([
        [
            {
                ability: "bandage",
            },
            {
                self: {
                    player: playerOne.player,
                },
                target: {
                    player: playerOne.player,
                },
            },
        ],
    ]);

    /**
     * Test query flow (playerOne scratch self) - should not resolve
     */

    // Tokenize query
    query = "scratch gandalf";
    queryTokens = tokenize(query);

    // Retrieve entities relevant to query from the environment
    var {
        monsters,
        players,
        items,
        tokenPositions: entityTokenPositions,
    } = entitiesIR({
        queryTokens,
        monsters: [dragon, goblin],
        players: [playerOne, playerTwo, playerThree],
        items: [woodendoor, woodenclub, portal],
    });

    // Retrieve actions and abilities relevant to query
    var {
        itemUtilities: itemUtilitiesPossible,
        abilities: abilitiesPossible,
        tokenPositions: abilityTokenPositions,
    } = gameActionsIR({
        queryTokens,
        abilities: playerAbilities,
        itemUtilities,
        actions: [],
    });

    // Resolve abilities relevant to retrieved entities (may have multiple resolutions - allow selection by user)
    abilityEntities = abilitiesPossible
        .map((ability) => [
            ability,
            resolveAbilityEntities({
                queryTokens,
                tokenPositions: {
                    ...entityTokenPositions,
                    ...abilityTokenPositions,
                },
                ability: ability.ability,
                self: playerOne,
                monsters,
                players,
                items,
            }),
        ])
        .filter(([ability, entities]) => entities != null);

    // Should not resolve - cant scratch self
    expect(abilityEntities.length).toBe(0);
    expect(abilityEntities).toMatchObject([]);

    /**
     * Test `searchPossibleCommands`
     */

    // Test ability on self
    let gameCommands = searchPossibleCommands({
        query: "bandage gandalf",
        // Player
        player: playerOne,
        playerAbilities: [abilities.scratch, abilities.bandage],
        playerItems: [woodenclub],
        actions: [],
        // Environment
        monsters: [goblin, dragon],
        players: [playerOne], // Note: need to include self to bandage
        items: [woodendoor],
    }).commands;
    expect(gameCommands).toMatchObject([
        [
            {
                ability: "bandage",
                type: "healing",
                predicate: {
                    self: ["player", "monster"],
                    target: ["player", "monster"],
                    targetSelfAllowed: true,
                },
            },
            {
                self: {
                    player: playerOne.player,
                    name: "Gandalf",
                },
                target: {
                    player: playerOne.player,
                    name: "Gandalf",
                },
            },
        ],
    ]);

    // Test item utility on monster
    gameCommands = searchPossibleCommands({
        query: "swing at goblin",
        // Player
        player: playerOne,
        playerAbilities: [abilities.scratch, abilities.bandage],
        playerItems: [woodenclub],
        actions: [],
        // Environment
        monsters: [goblin, dragon],
        players: [playerOne], // Note: need to include self to bandage
        items: [woodendoor],
    }).commands;

    expect(gameCommands).toMatchObject([
        [
            {
                utility: "swing",
                description: "Swing the club at a target.",
                ability: "swing",
                requireEquipped: true,
            },
            {
                self: {
                    player: playerOne.player,
                },
                target: {
                    monster: goblin.monster,
                    name: "goblin",
                    beast: "goblin",
                },
                item: {
                    item: woodenclub.item,
                    name: "Wooden Club",
                    prop: "woodenclub",
                },
            },
        ],
    ]);

    // Test both utility and ability
    gameCommands = searchPossibleCommands({
        query: "swing at goblin",
        // Player
        player: playerOne,
        playerAbilities: [
            abilities.scratch,
            abilities.bandage,
            abilities.swing,
        ], // has swing action
        playerItems: [woodenclub], // has swing utility
        actions: [],
        // Environment
        monsters: [goblin, dragon],
        players: [playerOne], // Note: need to include self to bandage
        items: [woodendoor],
    }).commands;
    expect(gameCommands).toMatchObject([
        [
            {
                ability: "swing",
                type: "offensive",
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
        [
            {
                utility: "swing",
            },
            {
                self: {
                    player: playerOne.player,
                },
                target: {
                    monster: goblin.monster,
                },
                item: {
                    item: woodenclub.item,
                },
            },
        ],
    ]);

    // Test non ability utility
    gameCommands = searchPossibleCommands({
        query: "open woodendoor",
        // Player
        player: playerOne,
        playerAbilities: [
            abilities.scratch,
            abilities.bandage,
            abilities.swing,
        ], // has swing action
        playerItems: [woodenclub], // has swing utility
        actions: [],
        // Environment
        monsters: [goblin, dragon],
        players: [playerOne], // Note: need to include self to bandage
        items: [woodendoor],
    }).commands;
    expect(gameCommands).toMatchObject([
        [
            {
                utility: "open",
                description: "Open the door.",
                cost: {
                    charges: 0,
                    durability: 0,
                },
                state: {
                    start: "closed",
                    end: "open",
                },
            },
            {
                self: {
                    player: playerOne.player,
                },
                item: {
                    item: woodendoor.item,
                },
            },
        ],
    ]);
});
