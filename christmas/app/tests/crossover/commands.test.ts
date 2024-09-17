import {
    crossoverCmdEquip,
    crossoverCmdTake,
    stream,
} from "$lib/crossover/client";
import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands, type GameCommand } from "$lib/crossover/ir";
import { geohashNeighbour } from "$lib/crossover/utils";
import { entityStats } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import {
    spawnItemAtGeohash,
    spawnMonster,
} from "$lib/server/crossover/dungeonMaster";
import { initializeClients, saveEntity } from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import {
    allActions,
    createRandomPlayer,
    createWorldAsset,
    generateRandomGeohash,
    waitForEventData,
} from "./utils";

const region = String.fromCharCode(...getRandomRegion());
const playerOneGeohash = generateRandomGeohash(8, "h9");

let playerOne: Player;
let playerTwo: Player;
let playerOneCookies: string;
let playerTwoCookies: string;
let eventStreamOne: EventTarget;
let eventStreamTwo: EventTarget;
let woodendoor: Item;
let woodenclub: Item;
let woodenclub2: Item;
let woodenclub3: Item;
let tavern: ItemEntity;
let tavernGeohash: string;
let portal: Item;
let dragon: Monster;
let goblin: Monster;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Create Players
    [, playerOneCookies, playerOne] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: "Gandalf",
    });
    [, playerTwoCookies, playerTwo] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: "Saruman",
    });

    // Create streams
    [eventStreamOne] = await stream({ Cookie: playerOneCookies });
    await expect(
        waitForEventData(eventStreamOne, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    [eventStreamTwo] = await stream({ Cookie: playerTwoCookies });
    await expect(
        waitForEventData(eventStreamTwo, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // Spawn items and monsters
    woodendoor = (await spawnItemAtGeohash({
        geohash: geohashNeighbour(playerOneGeohash, "n"),
        prop: compendium.woodendoor.prop,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        variables: {
            [compendium.woodendoor.variables.doorsign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    woodenclub = (await spawnItemAtGeohash({
        geohash: playerOneGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    woodenclub2 = (await spawnItemAtGeohash({
        geohash: playerOneGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    woodenclub3 = (await spawnItemAtGeohash({
        geohash: playerOneGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.woodenclub.prop,
    })) as ItemEntity;

    portal = (await spawnItemAtGeohash({
        geohash: playerOne.loc[0],
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.portal.prop,
    })) as ItemEntity;

    tavernGeohash = generateRandomGeohash(8, "h9");
    const { url } = await createWorldAsset();
    tavern = (await spawnItemAtGeohash({
        geohash: tavernGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        prop: compendium.tavern.prop,
        variables: {
            url,
        },
    })) as ItemEntity;

    dragon = await spawnMonster({
        geohash: geohashNeighbour(geohashNeighbour(playerOneGeohash, "s"), "s"),
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        beast: "dragon",
    });

    goblin = await spawnMonster({
        geohash: playerOneGeohash,
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        beast: "goblin",
    });
});

beforeEach(async () => {
    // Reset stats
    playerOne = {
        ...playerOne,
        ...entityStats(playerOne),
        loc: [playerOneGeohash],
    };
    playerOne = (await saveEntity(playerOne as PlayerEntity)) as Player;
    goblin = {
        ...goblin,
        ...entityStats(goblin),
    };
    goblin = (await saveEntity(goblin as MonsterEntity)) as Monster;
    dragon = {
        ...dragon,
        ...entityStats(dragon),
    };
    dragon = (await saveEntity(dragon as MonsterEntity)) as Monster;
});

describe("Command Tests", () => {
    test("Learn skill from player", async () => {
        // Test `searchPossibleCommands`
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: `learn exploration from ${playerTwo.name}`,
                player: playerOne,
                playerAbilities: [
                    abilities.scratch,
                    abilities.bandage,
                    abilities.swing,
                ],
                playerItems: [woodenclub],
                actions: allActions,
                monsters: [goblin, dragon],
                players: [playerOne, playerTwo],
                items: [woodendoor, tavern],
                skills: [...SkillLinesEnum],
            });
        expect(commands).toMatchObject([
            [
                {
                    action: "learn",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        player: playerTwo.player,
                    },
                    skill: "exploration",
                },
                {
                    query: "learn exploration from saruman",
                    queryIrrelevant: "from",
                },
            ],
        ]);
    });

    test("Create writ", async () => {
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: `writ buy woodenclub,potionofhealth for 100lum,50umb`,
                player: playerOne,
                playerAbilities: [
                    abilities.scratch,
                    abilities.bandage,
                    abilities.swing,
                ],
                playerItems: [woodenclub],
                actions: allActions,
                monsters: [goblin, dragon],
                players: [playerOne, playerTwo],
                items: [woodendoor, tavern],
                skills: [...SkillLinesEnum],
            });
        expect(commands).toMatchObject([
            [
                {
                    action: "writ",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    receive: {
                        items: [],
                        props: [],
                        currency: {
                            lum: 100,
                            umb: 50,
                        },
                    },
                    offer: {
                        items: [],
                        props: ["woodenclub", "potionofhealth"],
                        currency: {
                            lum: 0,
                            umb: 0,
                        },
                    },
                },
                {
                    query: `writ buy woodenclub,potionofhealth for 100lum,50umb`.toLowerCase(),
                    queryIrrelevant: "buy for",
                },
            ],
        ]);
    });

    test("Fulfill writ", async () => {});

    test("Trade with player", async () => {
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: `sell ${woodenclub.item} to ${playerTwo.name} for 100lum,50umb`,
                player: playerOne,
                playerAbilities: [
                    abilities.scratch,
                    abilities.bandage,
                    abilities.swing,
                ],
                playerItems: [woodenclub],
                actions: allActions,
                monsters: [goblin, dragon],
                players: [playerOne, playerTwo],
                items: [woodendoor, tavern],
                skills: [...SkillLinesEnum],
            });

        expect(commands).toMatchObject([
            [
                {
                    action: "sell",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        player: playerTwo.player,
                    },
                    offer: {
                        items: [woodenclub.item],
                        currency: {
                            lum: 0,
                            umb: 0,
                        },
                    },
                    receive: {
                        items: [],
                        currency: {
                            lum: 100,
                            umb: 50,
                        },
                    },
                },
                {
                    query: `sell ${woodenclub.item} to ${playerTwo.name} for 100lum,50umb`.toLowerCase(),
                    queryIrrelevant: "to for",
                },
            ],
        ]);
    });

    test("Browse player writs", async () => {
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: `browse ${playerTwo.name}`,
                player: playerOne,
                playerAbilities: [
                    abilities.scratch,
                    abilities.bandage,
                    abilities.swing,
                ],
                playerItems: [woodenclub],
                actions: allActions,
                monsters: [goblin, dragon],
                players: [playerOne, playerTwo],
                items: [woodendoor, tavern],
                skills: [...SkillLinesEnum],
            });
        expect(commands).toMatchObject([
            [
                {
                    action: "browse",
                    description:
                        "Browse the goods a merchant is selling or buying.",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        player: playerTwo.player,
                    },
                },
                {
                    query: "browse saruman",
                    queryIrrelevant: "",
                },
            ],
        ]);
    });

    test("Enter tavern", async () => {
        // Move to tavern
        playerOne.loc = [tavernGeohash];
        playerOne = (await saveEntity(playerOne as PlayerEntity)) as Player;

        // Test `searchPossibleCommands`
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: "enter tavern",
                player: playerOne,
                playerAbilities: [
                    abilities.scratch,
                    abilities.bandage,
                    abilities.swing,
                ],
                playerItems: [woodenclub],
                actions: allActions,
                monsters: [goblin, dragon],
                players: [playerOne],
                items: [woodendoor, tavern],
                skills: [...SkillLinesEnum],
            });
        expect(queryTokens).toMatchObject(["enter", "tavern"]);
        expect(tokenPositions).toMatchObject({
            [tavern.item]: {
                "1": {
                    token: "tavern",
                    score: 1,
                },
            },
            enter: {
                "0": {
                    token: "enter",
                    score: 1,
                },
            },
        });
        expect(commands).toMatchObject([
            [
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
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: tavern.item,
                    },
                },
                {
                    query: "enter tavern",
                    queryIrrelevant: "",
                },
            ],
        ]);

        // Test enter tavern
        const enterTavern = commands[0];
        setTimeout(
            () => executeGameCommand(enterTavern, { Cookie: playerOneCookies }),
            10,
        );
        let result = await waitForEventData(eventStreamOne, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [
                {
                    player: playerOne.player,
                    locT: "in",
                    locI: tavern.item,
                },
            ],
            monsters: [],
            items: [],
            op: "upsert",
        });

        // Test exit tavern
    });

    test("Open and close door", async () => {
        // Test open door
        const openDoor: GameCommand = searchPossibleCommands({
            query: "open woodendoor",
            player: playerOne,
            playerAbilities: [
                abilities.scratch,
                abilities.bandage,
                abilities.swing,
            ],
            playerItems: [woodenclub],
            actions: [],
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodendoor],
            skills: [...SkillLinesEnum],
        }).commands[0];
        setTimeout(
            () => executeGameCommand(openDoor, { Cookie: playerOneCookies }),
            10,
        );
        let result = await waitForEventData(eventStreamOne, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [],
            monsters: [],
            items: [{ item: woodendoor.item, state: "open" }],
        });

        // Test close door
        const closeDoor: GameCommand = searchPossibleCommands({
            query: "close woodendoor",
            player: playerOne,
            playerAbilities: [
                abilities.scratch,
                abilities.bandage,
                abilities.swing,
            ],
            playerItems: [woodenclub],
            actions: [],
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodendoor],
            skills: [...SkillLinesEnum],
        }).commands[0];
        setTimeout(
            () => executeGameCommand(closeDoor, { Cookie: playerOneCookies }),
            10,
        );
        result = await waitForEventData(eventStreamOne, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [],
            monsters: [],
            items: [{ item: woodendoor.item, state: "closed" }],
        });
    });

    test("Use ability on monster", async () => {
        const scratchGoblin: GameCommand = searchPossibleCommands({
            query: "scratch goblin",
            player: playerOne,
            playerAbilities: [
                abilities.scratch,
                abilities.bandage,
                abilities.swing,
            ],
            playerItems: [woodenclub],
            actions: [],
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodendoor],
            skills: [...SkillLinesEnum],
        }).commands[0];

        setTimeout(
            () =>
                executeGameCommand(scratchGoblin, { Cookie: playerOneCookies }),
            0,
        );

        let result = await waitForEventData(eventStreamOne, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [{ player: playerOne.player, st: 10, ap: 3 }],
            monsters: [],
            items: [],
        });

        result = await waitForEventData(eventStreamOne, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [{ player: playerOne.player, st: 10, ap: 3 }],
            monsters: [{ monster: goblin.monster, hp: 9, mp: 10, st: 10 }],
            items: [],
        });
    });

    test("Use utility on monster", async () => {
        // Take wooden club
        await crossoverCmdTake(
            { item: woodenclub.item },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(eventStreamOne, "entities"); // Wait for look update
        await sleep(MS_PER_TICK * 2); // wait till not busy

        // Equip wooden club
        await crossoverCmdEquip(
            { item: woodenclub.item, slot: "rh" },
            { Cookie: playerOneCookies },
        );
        await waitForEventData(eventStreamOne, "entities"); // Wait for inventory update
        await sleep(MS_PER_TICK * 2); // wait till not busy

        // Swing wooden club at goblin
        const swingGoblin: GameCommand = searchPossibleCommands({
            query: "swing goblin",
            player: playerOne,
            playerAbilities: [abilities.scratch, abilities.bandage],
            playerItems: [woodenclub],
            actions: [],
            monsters: [goblin, dragon],
            players: [playerOne],
            items: [woodendoor],
            skills: [...SkillLinesEnum],
        }).commands[0];
        expect(swingGoblin).toMatchObject([
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
        ]);
        await executeGameCommand(swingGoblin, { Cookie: playerOneCookies });
        let result = await waitForEventData(eventStreamOne, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [{ player: playerOne.player, hp: 11, mp: 12, st: 11 }],
            monsters: [{ monster: goblin.monster, hp: 9 }],
            items: [],
        });
        result = await waitForEventData(eventStreamOne, "entities");
        expect(result).toMatchObject({
            event: "entities",
            players: [],
            monsters: [],
            items: [
                { item: woodenclub.item, dur: 99, chg: 0, state: "default" },
            ],
        });
    });
});
