import { entitiesIR, gameActionsIR, tokenize } from "$lib/crossover/ir";
import type { Item } from "$lib/crossover/types";
import {
    resolveAbilityEntities,
    type Ability,
} from "$lib/crossover/world/abilities";
import { type Utility } from "$lib/crossover/world/compendium";
import { abilities } from "$lib/crossover/world/settings/abilities";
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
});
