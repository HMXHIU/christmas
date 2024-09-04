import {
    entitiesIR,
    fuzzyMatch,
    gameActionsIR,
    tokenize,
} from "$lib/crossover/ir";
import { type Ability } from "$lib/crossover/world/abilities";
import { actions } from "$lib/crossover/world/actions";
import type { Utility } from "$lib/crossover/world/compendium";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { spawnItem, spawnMonster } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { beforeAll, describe, expect, it } from "vitest";
import { getRandomRegion } from "../utils";
import {
    createRandomPlayer,
    createWorldAsset,
    generateRandomGeohash,
} from "./utils";

const region = String.fromCharCode(...getRandomRegion());

const playerOneName = "Gandalf";
const playerTwoName = "Saruman";
let playerOne: Player;
let playerTwo: Player;
let woodendoor: Item;
let woodenclub: Item;
let woodenclub2: Item;
let woodenclub3: Item;
let portal: Item;
let dragon: Monster;
let goblin: Monster;
let playerOneGeohash: string;
let playerTwoGeohash: string;

let tavern: ItemEntity;
let tavernGeohash: string;

const allActions = [
    actions.say,
    actions.look,
    actions.move,
    actions.take,
    actions.drop,
    actions.equip,
    actions.unequip,
    actions.create,
    actions.configure,
    actions.inventory,
    actions.rest,
    actions.enter,
];

describe("IR Tests", () => {
    beforeAll(async () => {
        await initializeClients(); // create redis repositories

        // Player - playerOne
        playerOneGeohash = generateRandomGeohash(8, "h9");
        [, , playerOne] = await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

        // Player - playerTwo
        playerTwoGeohash = generateRandomGeohash(8, "h9");
        [, , playerTwo] = await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });

        // Items
        woodendoor = (await spawnItem({
            geohash: generateRandomGeohash(8, "h9"),
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.woodendoor.prop,
            variables: {
                [compendium.woodendoor.variables!.doorsign.variable]:
                    "A custom door sign",
            },
        })) as ItemEntity;

        woodenclub = await spawnItem({
            geohash: generateRandomGeohash(8, "h9"),
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.woodenclub.prop,
        });

        woodenclub2 = await spawnItem({
            geohash: generateRandomGeohash(8, "h9"),
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.woodenclub.prop,
        });

        woodenclub3 = await spawnItem({
            geohash: generateRandomGeohash(8, "h9"),
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.woodenclub.prop,
        });

        portal = (await spawnItem({
            geohash: playerOneGeohash,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.portal.prop,
        })) as ItemEntity;

        tavernGeohash = generateRandomGeohash(8, "h9");
        const { url } = await createWorldAsset();
        tavern = (await spawnItem({
            geohash: tavernGeohash,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.tavern.prop,
            variables: {
                url,
            },
        })) as ItemEntity;

        // Monsters
        dragon = await spawnMonster({
            geohash: generateRandomGeohash(8, "h9"),
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            beast: "dragon",
            level: 1,
        });

        goblin = await spawnMonster({
            geohash: generateRandomGeohash(8, "h9"),
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            beast: "goblin",
            level: 1,
        });
    });

    describe("fuzzyMatch Tests", () => {
        it("should match identical strings", () => {
            expect(fuzzyMatch("Gandalf", "Gandalf", 1)).toMatchObject({
                isMatch: true,
                score: 0,
                normalizedScore: 1,
            });
        });

        it("should not match different strings with a high score threshold", () => {
            expect(fuzzyMatch("bandage", "gandalf", 1)).toMatchObject({
                isMatch: false,
                score: 3,
                normalizedScore: 0,
            });
        });

        it("should match different strings with a low score threshold", () => {
            expect(fuzzyMatch("bandage", "gandalf", 3)).toMatchObject({
                isMatch: true,
                score: 3,
            });
        });
    });

    describe("entitiesIR Tests", () => {
        it("should find a player by name", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize("Gandalf"),
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodendoor, woodenclub],
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

        it("should find a player by player id", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize(playerOne.player),
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodendoor, woodenclub],
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

        it("should find an item by name", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize(woodenclub.name),
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodendoor, woodenclub],
                }),
            ).toMatchObject({
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
        });

        it("should find a monster by name", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize(dragon.name),
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodendoor, woodenclub],
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

        it("should partially match a player name", () => {
            const res = entitiesIR({
                queryTokens: tokenize("Gandaf"), // subtracted one letter
                monsters: [dragon, goblin],
                players: [playerOne, playerTwo],
                items: [woodendoor, woodenclub],
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

        it("should fail to match a player name with too many errors", () => {
            expect(
                entitiesIR({
                    queryTokens: tokenize("Gan"), // too much error
                    monsters: [dragon, goblin],
                    players: [playerOne, playerTwo],
                    items: [woodendoor, woodenclub],
                }),
            ).toMatchObject({
                monsters: [],
                players: [],
                items: [],
                tokenPositions: {},
            });
        });

        it("should match multiple entities in a query", () => {
            const res = entitiesIR({
                queryTokens: tokenize("Gandaf attacks gobli"), // subtracted one letter
                monsters: [dragon, goblin],
                players: [playerOne, playerTwo],
                items: [woodendoor, woodenclub],
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

        it("should match multiple items with the same prop", () => {
            const res = entitiesIR({
                queryTokens: tokenize(`take ${woodenclub.item}`),
                monsters: [dragon, goblin],
                players: [playerOne],
                items: [woodenclub, woodenclub2, woodenclub3],
            });
            expect(res).toMatchObject({
                monsters: [],
                players: [],
                items: [
                    {
                        item: woodenclub.item,
                    },
                    {
                        item: woodenclub2.item,
                    },
                    {
                        item: woodenclub3.item,
                    },
                ],
                tokenPositions: {
                    [woodenclub.item]: {
                        "1": {
                            token: woodenclub.item,
                        },
                    },
                    [woodenclub2.item]: {
                        "1": {
                            token: woodenclub.item,
                        },
                    },
                    [woodenclub3.item]: {
                        "1": {
                            token: woodenclub.item,
                        },
                    },
                },
            });
            expect(res.tokenPositions[woodenclub.item]["1"].score).toBe(1);
            expect(
                res.tokenPositions[woodenclub2.item]["1"].score,
            ).toBeGreaterThan(0.8);
            expect(
                res.tokenPositions[woodenclub3.item]["1"].score,
            ).toBeGreaterThan(0.8);
        });
    });

    describe("gameActionsIR Tests", () => {
        let itemUtilities: [Item, Utility][], playerAbilities: Ability[];

        beforeAll(() => {
            itemUtilities = [woodenclub, woodendoor, portal, tavern].flatMap(
                (item) => {
                    return Object.values(compendium[item.prop].utilities).map(
                        (utility): [Item, Utility] => {
                            return [item, utility];
                        },
                    );
                },
            );
            playerAbilities = Object.values(abilities);
        });

        it("`enter` action on eligible item", () => {
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
                        predicate: {
                            target: ["item"],
                            tokenPositions: {
                                action: 0,
                                target: 1,
                            },
                        },
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

        it("should match an item utility action", () => {
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
        });

        it("should match an ability with a minor error", () => {
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

        it("should match both an ability and an item utility with the same token", () => {
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
    });
});
