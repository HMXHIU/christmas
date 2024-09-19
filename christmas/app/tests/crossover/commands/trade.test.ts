import { executeGameCommand } from "$lib/crossover/game";
import { searchPossibleCommands } from "$lib/crossover/ir";
import type { ItemEntity, PlayerEntity } from "$lib/crossover/types";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { spawnItemInInventory } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import { inventoryQuerySet } from "$lib/server/crossover/redis/queries";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import { sleep } from "$lib/utils";
import { beforeEach, describe, expect, test } from "vitest";
import {
    allActions,
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
    resetPlayerResources,
} from "../utils";

await initializeClients(); // create redis repositories

let { geohash, playerOne, playerTwo, playerOneCookies, playerTwoCookies } =
    await createGandalfSarumanSauron();
let { dragon, goblin } = await createGoblinSpiderDragon(geohash);
let { woodenDoor, woodenClub } = await createTestItems({});

beforeEach(async () => {
    resetPlayerResources(playerOne, playerTwo);
});

describe("Trade Tests", () => {
    test("Create writ", async () => {
        // Test command search
        const { commands, queryTokens, tokenPositions } =
            searchPossibleCommands({
                query: `writ trade 100lum,50umb for woodenClub,potionofhealth`,
                player: playerOne,
                playerAbilities: [
                    abilities.scratch,
                    abilities.bandage,
                    abilities.swing,
                ],
                playerItems: [woodenClub],
                actions: allActions,
                monsters: [goblin, dragon],
                players: [playerOne, playerTwo],
                items: [woodenDoor],
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
                    query: `writ trade 100lum,50umb for woodenClub,potionofhealth`.toLowerCase(),
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
            playerItems: [woodenClub],
            actions: allActions,
            monsters: [goblin, dragon],
            players: [playerOne, playerTwo],
            items: [woodenDoor],
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
                query: `trade ${woodenClub.item} for 100lum,50umb with ${playerTwo.name}`,
                player: playerOne,
                playerAbilities: [
                    abilities.scratch,
                    abilities.bandage,
                    abilities.swing,
                ],
                playerItems: [woodenClub],
                actions: allActions,
                monsters: [goblin, dragon],
                players: [playerOne, playerTwo],
                items: [woodenDoor],
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
                        items: [woodenClub.item],
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
                    query: `trade ${woodenClub.item} for 100lum,50umb with ${playerTwo.name}`.toLowerCase(),
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
                playerItems: [woodenClub],
                actions: allActions,
                monsters: [goblin, dragon],
                players: [playerOne, playerTwo],
                items: [woodenDoor],
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
