import {
    entitiesIR,
    fuzzyMatch,
    gameActionsIR,
    getCommandVariables,
    tokenize,
} from "$lib/crossover/ir";
import type { Item } from "$lib/crossover/types";
import { type Ability } from "$lib/crossover/world/abilities";
import { resolveActionEntities } from "$lib/crossover/world/actions";
import type { Utility } from "$lib/crossover/world/compendium";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { describe, expect, test } from "vitest";
import {
    allActions,
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createNPCs,
    createTestItems,
} from "../utils";

let { geohash, playerOne, playerTwo } = await createGandalfSarumanSauron();
let {
    woodenDoor,
    woodenClub,
    woodenClubThree,
    woodenClubTwo,
    portalOne,
    tavern,
} = await createTestItems({});
let { goblin, dragon } = await createGoblinSpiderDragon();

const { innKeeper } = await createNPCs({
    geohash,
    locationInstance: LOCATION_INSTANCE,
    locationType: "geohash",
});

describe("IR Tests", () => {
    describe("Query irrelevant & command variables", () => {
        test("Test token positions and query irrelevant", () => {
            const queryTokens = tokenize("greet inn keeper");

            const ga = gameActionsIR({
                queryTokens,
                abilities: [],
                itemUtilities: [],
                actions: allActions,
            });
            expect(ga.tokenPositions).toMatchObject({
                say: {
                    "0": {
                        token: "greet",
                        score: 1,
                    },
                },
            });

            const entitiesRetrieved = entitiesIR({
                queryTokens,
                monsters: [],
                players: [innKeeper],
                items: [],
                skills: [],
            });
            expect(entitiesRetrieved).toMatchObject({
                players: [
                    {
                        player: innKeeper.player,
                        name: "Inn Keeper",
                        npc: innKeeper.player,
                    },
                ],
                tokenPositions: {
                    [innKeeper.player]: {
                        "1": {
                            token: "inn",
                            score: 1,
                        },
                        "2": {
                            token: "keeper",
                            score: 1,
                        },
                    },
                },
            });

            const allTokenPositions = {
                ...entitiesRetrieved.tokenPositions,
                ...ga.tokenPositions,
            };

            expect(allTokenPositions).toMatchObject({
                [innKeeper.player]: {
                    "1": {
                        token: "inn",
                        score: 1,
                    },
                    "2": {
                        token: "keeper",
                        score: 1,
                    },
                },
                say: {
                    "0": {
                        token: "greet",
                        score: 1,
                    },
                },
            });

            const entitiesResolved = resolveActionEntities({
                queryTokens,
                tokenPositions: allTokenPositions,
                action: actions.say,
                self: playerOne,
                monsters: [],
                players: [innKeeper],
                items: [],
                skills: [],
            });

            expect(entitiesResolved).toMatchObject([
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        player: innKeeper.player,
                        npc: innKeeper.player,
                    },
                },
            ]);

            const variables = getCommandVariables({
                action: actions.say,
                gameEntities: entitiesResolved[0],
                queryTokens,
                tokenPositions: allTokenPositions,
            });

            expect(variables).toMatchObject({
                query: "greet inn keeper",
                queryIrrelevant: "",
            });
        });
    });

    describe("fuzzyMatch Tests", () => {
        test("should match identical strings", () => {
            expect(fuzzyMatch("Gandalf", "Gandalf", 1)).toMatchObject({
                isMatch: true,
                score: 0,
                normalizedScore: 1,
            });
        });

        test("should not match different strings with a high score threshold", () => {
            expect(fuzzyMatch("bandage", "gandalf", 1)).toMatchObject({
                isMatch: false,
                score: 3,
                normalizedScore: 0,
            });
        });

        test("should match different strings with a low score threshold", () => {
            expect(fuzzyMatch("bandage", "gandalf", 3)).toMatchObject({
                isMatch: true,
                score: 3,
            });
        });
    });

    describe("entitiesIR Tests", () => {
        test("should find skill", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize("exploration"),
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodenDoor, woodenClub],
                    skills: [...SkillLinesEnum],
                }),
            ).toMatchObject({
                monsters: [],
                players: [],
                items: [],
                skills: ["exploration"],
                tokenPositions: {
                    exploration: {
                        "0": {
                            token: "exploration",
                            score: 1,
                        },
                    },
                },
            });
        });

        test("should find a player by name", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize("Gandalf"),
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodenDoor, woodenClub],
                    skills: [...SkillLinesEnum],
                }),
            ).toMatchObject({
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
        });

        test("should find a player by player id", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize(playerOne.player),
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodenDoor, woodenClub],
                    skills: [...SkillLinesEnum],
                }),
            ).toMatchObject({
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
        });

        test("should find an item by name", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize(woodenClub.name),
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodenDoor, woodenClub],
                    skills: [...SkillLinesEnum],
                }),
            ).toMatchObject({
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
        });

        test("should find a monster by name", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize(dragon.name),
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodenDoor, woodenClub],
                    skills: [...SkillLinesEnum],
                }),
            ).toMatchObject({
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
        });

        test("should partially match a player name", () => {
            const res = entitiesIR({
                queryTokens: tokenize("Gandaf"), // subtracted one letter
                monsters: [dragon, goblin],
                players: [playerOne, playerTwo],
                items: [woodenDoor, woodenClub],
                skills: [...SkillLinesEnum],
            });
            expect(res).toMatchObject({
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
                        },
                    },
                },
            });
            expect(
                res.tokenPositions[playerOne.player]["0"].score,
            ).toBeGreaterThan(0.8);
        });

        test("should fail to match a player name with too many errors", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize("Gan"), // too much error
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodenDoor, woodenClub],
                    skills: [...SkillLinesEnum],
                }),
            ).toMatchObject({
                monsters: [],
                players: [],
                items: [],
                tokenPositions: {},
            });
        });

        test("should match multiple entities in a query", () => {
            const res = entitiesIR({
                queryTokens: tokenize("Gandaf attacks gobli"), // subtracted one letter
                monsters: [dragon, goblin],
                players: [playerOne, playerTwo],
                items: [woodenDoor, woodenClub],
                skills: [...SkillLinesEnum],
            });
            expect(res).toMatchObject({
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
                        },
                    },
                    [playerOne.player]: {
                        "0": {
                            token: "gandaf",
                        },
                    },
                },
            });
            expect(
                res.tokenPositions[goblin.monster]["2"].score,
            ).toBeGreaterThan(0.8);
            expect(
                res.tokenPositions[playerOne.player]["0"].score,
            ).toBeGreaterThan(0.8);
        });

        test("should match multiple items with the same prop", () => {
            const res = entitiesIR({
                queryTokens: tokenize(`take woodenclub`),
                monsters: [dragon, goblin],
                players: [playerOne],
                items: [woodenClub, woodenClubTwo, woodenClubThree],
                skills: [...SkillLinesEnum],
            });

            expect(res).toMatchObject({
                monsters: [],
                players: [],
                items: [
                    {
                        item: woodenClub.item,
                    },
                    {
                        item: woodenClubTwo.item,
                    },
                    {
                        item: woodenClubThree.item,
                    },
                ],
                tokenPositions: {
                    [woodenClub.item]: {
                        "1": {
                            token: "woodenclub",
                        },
                    },
                    [woodenClubTwo.item]: {
                        "1": {
                            token: "woodenclub",
                        },
                    },
                    [woodenClubThree.item]: {
                        "1": {
                            token: "woodenclub",
                        },
                    },
                },
            });
            expect(res.tokenPositions[woodenClub.item]["1"].score).toBe(1);
            expect(
                res.tokenPositions[woodenClubTwo.item]["1"].score,
            ).toBeGreaterThan(0.8);
            expect(
                res.tokenPositions[woodenClubThree.item]["1"].score,
            ).toBeGreaterThan(0.8);
        });
    });

    describe("gameActionsIR Tests", () => {
        let itemUtilities: [Item, Utility][] = [
            woodenClub,
            woodenDoor,
            portalOne,
            tavern,
        ].flatMap((item) => {
            return Object.values(compendium[item.prop].utilities).map(
                (utility): [Item, Utility] => {
                    return [item, utility];
                },
            );
        });
        let playerAbilities: Ability[] = Object.values(abilities);

        test("`say` action synonyms", () => {
            const ga = gameActionsIR({
                queryTokens: tokenize("greet gandalf"),
                abilities: playerAbilities,
                itemUtilities,
                actions: allActions,
            });
            expect(ga).toMatchObject({
                abilities: [],
                itemUtilities: [],
                actions: [
                    {
                        action: "say",
                        description: "Say something.",
                        synonyms: ["greet", "ask", "tell"],
                    },
                ],
                tokenPositions: {
                    say: {
                        "0": {
                            token: "greet",
                            score: 1,
                        },
                    },
                },
            });
        });

        test("`learn` skill from player", () => {
            const ga = gameActionsIR({
                queryTokens: tokenize("learn exploration from gandalf"),
                abilities: playerAbilities,
                itemUtilities,
                actions: allActions,
            });

            expect(ga).toMatchObject({
                abilities: [],
                itemUtilities: [],
                actions: [
                    {
                        action: "learn",
                    },
                ],
                tokenPositions: {
                    learn: {
                        "0": {
                            token: "learn",
                            score: 1,
                        },
                    },
                },
            });
        });

        test("`enter` action on eligible item", () => {
            const ga = gameActionsIR({
                queryTokens: tokenize("enter tavern"),
                abilities: playerAbilities,
                itemUtilities,
                actions: allActions,
            });

            expect(ga).toMatchObject({
                abilities: [],
                itemUtilities: [],
                actions: [
                    {
                        action: "enter",
                        description: "Enter.",
                    },
                ],
                tokenPositions: {
                    enter: {
                        "0": {
                            token: "enter",
                            score: 1,
                        },
                    },
                },
            });
        });

        test("should match an item utility action", () => {
            expect(
                gameActionsIR({
                    queryTokens: tokenize("open woodendoor"),
                    abilities: playerAbilities,
                    itemUtilities,
                    actions: [],
                }),
            ).toMatchObject({
                abilities: [],
                itemUtilities: [
                    [
                        {
                            item: woodenDoor.item,
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
        });

        test("should match an ability with a minor error", () => {
            const gas = gameActionsIR({
                queryTokens: tokenize("eyepok goblin"), // subtracted one letter
                abilities: playerAbilities,
                itemUtilities,
                actions: [],
            });
            expect(gas).toMatchObject({
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
                        },
                    },
                },
            });
            expect(gas.tokenPositions["eyePoke"]["0"].score).toBeGreaterThan(
                0.8,
            );
        });

        test("should match both an ability and an item utility with the same token", () => {
            expect(
                gameActionsIR({
                    queryTokens: tokenize("teleport to player"),
                    abilities: playerAbilities,
                    itemUtilities,
                    actions: [],
                }),
            ).toMatchObject({
                abilities: [
                    {
                        ability: "teleport",
                        description: "Teleport to the target location.",
                    },
                ],
                itemUtilities: [
                    [
                        {
                            item: portalOne.item,
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
    });
});
