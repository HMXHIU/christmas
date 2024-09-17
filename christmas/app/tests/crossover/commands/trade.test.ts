import { stream } from "$lib/crossover/client";
import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands } from "$lib/crossover/ir";
import { geohashNeighbour } from "$lib/crossover/utils";
import { actions } from "$lib/crossover/world/actions";
import { entityStats } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import {
    spawnItemAtGeohash,
    spawnItemInInventory,
    spawnMonster,
} from "$lib/server/crossover/dungeonMaster";
import {
    initializeClients,
    inventoryQuerySet,
    saveEntity,
} from "$lib/server/crossover/redis";
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
import { getRandomRegion } from "../../utils";
import {
    allActions,
    createRandomPlayer,
    createWorldAsset,
    generateRandomGeohash,
    waitForEventData,
} from "../utils";

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

describe("Trade Tests", () => {
    test("Create writ", async () => {
        // Test command search
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: `writ trade 100lum,50umb for woodenclub,potionofhealth`,
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
                    offer: {
                        items: [],
                        props: [],
                        currency: {
                            lum: 100,
                            umb: 50,
                        },
                    },
                    receive: {
                        items: [],
                        props: ["woodenclub", "potionofhealth"],
                        currency: {
                            lum: 0,
                            umb: 0,
                        },
                    },
                },
                {
                    query: `writ trade 100lum,50umb for woodenclub,potionofhealth`.toLowerCase(),
                    queryIrrelevant: "trade for",
                },
            ],
        ]);
    });

    test("Fulfill writ", async () => {
        /**
         * Fufill a writ offering to buy a prop
         */

        // `playerOne` create a writ to buy potionofhealth for 100lum
        const { commands: writCommands } = searchPossibleCommands({
            query: `writ trade 100lum for ${compendium.potionofhealth.prop}`,
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
        await executeGameCommand(writCommands[0], { Cookie: playerOneCookies });

        // Get inventory
        const invItems = (await inventoryQuerySet(
            playerOne.player,
        ).returnAll()) as ItemEntity[];

        // Find writ
        const writItem = invItems.find((i) => i.prop === "tradewrit");
        expect(writItem).toBeTruthy();
        expect(writItem).toMatchObject({
            vars: {
                receive: "Potion of Health",
                offer: "100 lum",
            },
        });

        // Give players the items to fulfill the writ
        await spawnItemInInventory({
            entity: playerTwo as PlayerEntity,
            prop: compendium.potionofhealth.prop,
        });
        playerOne.lum = 100;
        playerOne = (await saveEntity(
            playerOne as PlayerEntity,
        )) as PlayerEntity;

        // `playerTwo` fulfill `playerOne`s writ
        const {
            commands: fulfillCommands,
            queryTokens,
            tokenPositions,
        } = searchPossibleCommands({
            query: `fufill ${writItem?.item}`,
            player: playerTwo,
            playerAbilities: [],
            playerItems: [writItem!],
            actions: allActions,
            monsters: [],
            players: [playerTwo, playerOne],
            items: [writItem!],
            skills: [...SkillLinesEnum],
        });
        expect(fulfillCommands).toMatchObject([
            [
                {
                    action: "fulfill",
                },
                {
                    self: {
                        player: playerTwo.player,
                    },
                    target: {
                        item: writItem!.item,
                    },
                },
                {
                    query: `fufill ${writItem?.item}`,
                    queryIrrelevant: "",
                },
            ],
        ]);
        await executeGameCommand(fulfillCommands[0], {
            Cookie: playerTwoCookies,
        });

        await sleep(MS_PER_TICK * actions.trade.ticks * 2);

        // Check items
        var playerOneInventory = (await inventoryQuerySet(
            playerOne.player,
        ).returnAll()) as ItemEntity[];
        expect(playerOneInventory.length === 1).toBe(true); // writ should be destroyed
        expect(playerOneInventory).toMatchObject([
            {
                name: "Potion of Health",
                prop: "potionofhealth",
                loc: [playerOne.player],
                locT: "inv",
                locI: "@",
            },
        ]);
    });

    test("Trade with player", async () => {
        // Test command search
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: `trade ${woodenclub.item} for 100lum,50umb with ${playerTwo.name}`,
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
                    action: "trade",
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
                    query: `trade ${woodenclub.item} for 100lum,50umb with ${playerTwo.name}`.toLowerCase(),
                    queryIrrelevant: "for with",
                },
            ],
        ]);
    });

    test("Browse player writs", async () => {
        // Test command search
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
});
