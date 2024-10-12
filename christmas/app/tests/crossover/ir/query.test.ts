import {
    entitiesIR,
    gameActionsIR,
    searchPossibleCommands,
    tokenize,
} from "$lib/crossover/ir";
import type { Item } from "$lib/crossover/types";
import {
    resolveAbilityEntities,
    type Ability,
} from "$lib/crossover/world/abilities";
import { type Utility } from "$lib/crossover/world/compendium";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
} from "../utils";

describe("Query Tests", async () => {
    let { playerOne, playerTwo, playerThree } =
        await createGandalfSarumanSauron();
    let { woodenDoor, woodenClub, woodenClubThree, woodenClubTwo, portalOne } =
        await createTestItems({});
    let { goblin, goblinTwo, goblinThree, dragon } =
        await createGoblinSpiderDragon();

    const playerAbilities: Ability[] = Object.values(abilities);
    const itemUtilities: [Item, Utility][] = [
        woodenClub,
        woodenDoor,
        portalOne,
    ].flatMap((item) => {
        return Object.values(compendium[item.prop].utilities).map(
            (utility): [Item, Utility] => {
                return [item, utility];
            },
        );
    });

    test("Test Abilities (player bruise goblin)", async () => {
        let query = "bruise goblin";
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
            items: [woodenDoor, woodenClub, portalOne],
            skills: [...SkillLinesEnum],
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
        let abilityEntities = abilitiesPossible.flatMap((ability) => {
            return resolveAbilityEntities({
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
            }).map((entities) => [ability, entities]);
        });
        expect(abilityEntities).to.toMatchObject([
            [
                {
                    ability: "bruise",
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
    });

    test("Test Abilities (dragon breathe fire on goblin)", async () => {
        // Tokenize query
        const query = "breathFire on goblin";
        const queryTokens = tokenize(query);

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
            items: [woodenDoor, woodenClub, portalOne],
            skills: [...SkillLinesEnum],
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
        const abilityEntities = abilitiesPossible.flatMap((ability) => {
            return resolveAbilityEntities({
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
            }).map((entities) => [ability, entities]);
        });
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
    });

    test("Test query flow (playerOne bandage self)", async () => {
        /**
         * Test query flow (playerOne bandage self)
         */

        // Tokenize query
        const query = "bandage gandalf";
        const queryTokens = tokenize(query);

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
            items: [woodenDoor, woodenClub, portalOne],
            skills: [...SkillLinesEnum],
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
        const abilityEntities = abilitiesPossible.flatMap((ability) => {
            return resolveAbilityEntities({
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
            }).map((entities) => [ability, entities]);
        });
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
    });

    test("Test query flow (playerOne bruise self) - should not resolve", async () => {
        // Tokenize query
        const query = "bruise gandalf";
        const queryTokens = tokenize(query);

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
            items: [woodenDoor, woodenClub, portalOne],
            skills: [...SkillLinesEnum],
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
        const abilityEntities = abilitiesPossible.flatMap((ability) => {
            return resolveAbilityEntities({
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
            }).map((entities) => [ability, entities]);
        });

        // Should not resolve - cant bruise self
        expect(abilityEntities.length).toBe(0);
        expect(abilityEntities).toMatchObject([]);
    });

    test("Test searchPossibleCommands", async () => {
        // Test ability on self
        let gameCommands = searchPossibleCommands({
            query: "bandage gandalf",
            // Player
            player: playerOne,
            playerAbilities: [abilities.bruise, abilities.bandage],
            playerItems: [woodenClub],
            actions: [],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
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
        goblin.loc = playerOne.loc;
        gameCommands = searchPossibleCommands({
            query: "swing at goblin",
            // Player
            player: playerOne,
            playerAbilities: [abilities.bruise, abilities.bandage],
            playerItems: [woodenClub],
            actions: [],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    utility: "swing",
                    description: "Swing the club with all your strength.",
                    ability: "bruise",
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
                        item: woodenClub.item,
                        name: "Wooden Club",
                        prop: "woodenclub",
                    },
                },
            ],
        ]);

        // Test both utility and ability
        gameCommands = searchPossibleCommands({
            query: "swing bruise at goblin",
            // Player
            player: playerOne,
            playerAbilities: [abilities.bruise, abilities.bandage],
            playerItems: [woodenClub],
            actions: [],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    ability: "bruise",
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
                        item: woodenClub.item,
                    },
                },
            ],
        ]);

        // Test non ability utility
        playerOne.loc = woodenDoor.loc;
        gameCommands = searchPossibleCommands({
            query: "open woodenDoor",
            // Player
            player: playerOne,
            playerAbilities: [abilities.bruise, abilities.bandage], // has swing action
            playerItems: [woodenClub], // has swing utility
            actions: [],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
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
                        start: "default",
                        end: "open",
                    },
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    item: {
                        item: woodenDoor.item,
                    },
                },
            ],
        ]);

        // Test in presence of multiple of the same props
        woodenClub.loc =
            woodenClubTwo.loc =
            woodenClubThree.loc =
                playerOne.loc;
        gameCommands = searchPossibleCommands({
            query: `take ${woodenClubThree.item}`,
            // Player
            player: playerOne,
            playerAbilities: [],
            playerItems: [],
            actions: [actions.take],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenClub, woodenClubTwo, woodenClubThree],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands[0]).toMatchObject([
            {
                action: "take",
            },
            {
                self: {
                    player: playerOne.player,
                },
                target: {
                    item: woodenClubThree.item,
                },
            },
            {
                query: `take ${woodenClubThree.item}`,
            },
        ]);

        // Test should show multiple similar items (sorted by relevance)
        gameCommands = searchPossibleCommands({
            query: `take woodenClub`,
            // Player
            player: playerOne,
            playerAbilities: [],
            playerItems: [],
            actions: [actions.take],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenClub, woodenClubTwo, woodenClubThree],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    action: actions.take.action,
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: woodenClub.item,
                    },
                },
                {
                    query: `take woodenclub`,
                },
            ],
            [
                {
                    action: actions.take.action,
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: woodenClubTwo.item,
                    },
                },
                {
                    query: `take woodenclub`,
                },
            ],
            [
                {
                    action: actions.take.action,
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: woodenClubThree.item,
                    },
                },
                {
                    query: `take woodenclub`,
                },
            ],
        ]);

        // Test abilities should show multiple targets
        goblin.loc = goblinTwo.loc = goblinThree.loc = playerOne.loc;
        gameCommands = searchPossibleCommands({
            query: `bruise goblin`,
            // Player
            player: playerOne,
            playerAbilities: [abilities.bruise],
            playerItems: [],
            actions: [],
            // Environment
            monsters: [goblin, goblinTwo, goblinThree],
            players: [],
            items: [],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    ability: "bruise",
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
                    ability: "bruise",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        monster: goblinTwo.monster,
                    },
                },
            ],
            [
                {
                    ability: "bruise",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        monster: goblinThree.monster,
                    },
                },
            ],
        ]);
    });
});
