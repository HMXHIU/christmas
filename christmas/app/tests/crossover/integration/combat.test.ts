import {
    crossoverCmdAttack,
    crossoverCmdCreateItem,
    crossoverCmdDrop,
    crossoverCmdEquip,
    crossoverCmdUnequip,
    crossoverPlayerInventory,
} from "$lib/crossover/client";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    processActiveConditions,
    pushCondition,
} from "$lib/server/crossover/combat/condition";
import {
    fetchEntity,
    saveEntities,
    saveEntity,
} from "$lib/server/crossover/redis/utils";
import type { ItemEntity } from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { beforeEach, describe, expect, test } from "vitest";
import {
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
    flushStream,
    generateRandomGeohash,
} from "../utils";

describe("Combat Integration Tests", async () => {
    let {
        region,
        geohash,
        playerOne,
        playerTwo,
        playerThree,
        playerOneCookies,
        playerTwoCookies,
        playerThreeCookies,
        playerOneStream,
        playerTwoStream,
        playerThreeStream,
        playerOneWallet,
        playerTwoWallet,
        playerThreeWallet,
    } = await createGandalfSarumanSauron();

    beforeEach(async () => {
        geohash = generateRandomGeohash(8, "h9b");
        // `playerOne` and `playerTwo` should be same location
        playerOne.loc = [geohash];
        playerTwo.loc = [geohash];
        // Change `playerThree` location away from `playerOne` & `playerThree`
        playerThree.loc = [generateRandomGeohash(8, "h9r")];
        saveEntities(playerOne, playerTwo, playerThree);
    });

    test("Test Active Conditions", async () => {
        playerOne.cond = pushCondition(playerOne.cond, "burning", playerTwo);
        playerOne = await saveEntity(playerOne);

        // `processActiveConditions` for 1 turn to deal burning damage
        processActiveConditions();
        var evs = await collectAllEventDataForDuration(playerOneStream);
        expect(evs).toMatchObject({
            feed: [],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            player: playerOne.player,
                            hp: 1,
                            cond: expect.arrayContaining([
                                expect.stringMatching(
                                    new RegExp(
                                        `a:burning:\\d+:${playerTwo.player}`,
                                    ),
                                ),
                            ]),
                        },
                    ],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [],
        });

        // `processActiveConditions` for another turn, killing the player
        processActiveConditions();
        var evs = await collectAllEventDataForDuration(playerOneStream);
        expect(evs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: expect.stringContaining(
                        "a cold darkness envelops your senses",
                    ),
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            player: playerOne.player,
                            hp: -9,
                            cond: expect.arrayContaining([
                                expect.stringMatching(
                                    new RegExp(
                                        `a:burning:\\d+:${playerTwo.player}`,
                                    ),
                                ),
                            ]),
                        },
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
                // Respawn
                {
                    event: "entities",
                    players: [
                        {
                            player: playerOne.player,
                            hp: 11,
                            cond: [], // should be empty after respawn
                            buclk: 4000,
                        },
                    ],
                    op: "upsert",
                },
            ],
        });
    });

    test("Test Create, Take, Equip, Attack, Ability, Unequip, Drop Item", async () => {
        // Create Weapon In `playerOne` inventory
        await crossoverCmdCreateItem(
            {
                prop: compendium.woodenclub.prop,
            },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 4);

        // Check `playerOne` inventory
        crossoverPlayerInventory({ Cookie: playerOneCookies });
        var evs = await collectAllEventDataForDuration(playerOneStream);
        expect(evs).toMatchObject({
            feed: [],
            entities: [
                {
                    event: "entities",
                    players: [],
                    monsters: [],
                    items: [
                        {
                            prop: "woodenclub",
                            loc: [playerOne.player],
                            locT: "inv",
                            locI: "@",
                            own: playerOne.player,
                        },
                    ],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [],
        });

        // Get weapon
        let weapon = (await fetchEntity(
            evs.entities![0].items![0].item,
        )) as ItemEntity;
        expect(weapon == null).toBeFalsy();

        // Equip weapon
        await crossoverCmdEquip(
            { item: weapon.item },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 4);

        // Attack `playerTwo` with weapon
        let playerOneEvs;
        let playerTwoEvs;
        crossoverCmdAttack(
            { target: playerTwo.player },
            { Cookie: playerOneCookies },
        );
        collectAllEventDataForDuration(playerOneStream, 500).then(
            (evs) => (playerOneEvs = evs),
        );
        collectAllEventDataForDuration(playerTwoStream, 500).then(
            (evs) => (playerTwoEvs = evs),
        );
        await sleep(500);

        expect(playerOneEvs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf strikes Saruman, dealing 6 damage!",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            name: "Saruman",
                            player: playerTwo.player,
                            hp: 5,
                        },
                    ],
                    monsters: [],
                    items: [
                        {
                            name: "Wooden Club",
                            item: weapon.item,
                            prop: "woodenclub",
                            state: "default",
                            vars: {},
                            dur: weapon.dur - 1, // each attack reduces 1 dur
                            loc: [playerOne.player],
                            locT: "rh",
                            locI: "@",
                        },
                    ],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    action: "attack",
                    source: playerOne.player,
                    target: playerTwo.player,
                    event: "action",
                },
            ],
        });
        expect(playerTwoEvs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf strikes Saruman, dealing 6 damage!",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            name: "Saruman",
                            player: playerTwo.player,
                            hp: 5,
                        },
                    ],
                    monsters: [],
                    items: [
                        {
                            name: "Wooden Club",
                            item: weapon.item,
                            prop: "woodenclub",
                            state: "default",
                            vars: {},
                            dur: weapon.dur - 1, // each attack reduces 1 dur
                            loc: [playerOne.player],
                            locT: "rh",
                            locI: "@",
                        },
                    ],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    action: "attack",
                    source: playerOne.player,
                    target: playerTwo.player,
                    event: "action",
                },
            ],
        });

        // Unequip weapon
        await crossoverCmdUnequip(
            {
                item: weapon.item,
            },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 4);

        // Check weapon location
        weapon = (await fetchEntity(weapon.item)) as ItemEntity;
        expect(weapon).toMatchObject({
            loc: [playerOne.player],
            locT: "inv",
            locI: "@",
            own: playerOne.player,
            cfg: playerOne.player,
        });

        // Attack using unarmed attack
        await flushStream(playerOneStream);
        await flushStream(playerTwoStream);
        crossoverCmdAttack(
            { target: playerTwo.player },
            { Cookie: playerOneCookies },
        );
        collectAllEventDataForDuration(playerOneStream, 500).then(
            (evs) => (playerOneEvs = evs),
        );
        collectAllEventDataForDuration(playerTwoStream, 500).then(
            (evs) => (playerTwoEvs = evs),
        );
        await sleep(500);

        expect(playerOneEvs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf strikes Saruman, dealing 3 damage!",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            player: playerTwo.player,
                            hp: 2,
                        },
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    action: "attack",
                    source: playerOne.player,
                    target: playerTwo.player,
                    event: "action",
                },
            ],
        });

        expect(playerTwoEvs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "Gandalf strikes Saruman, dealing 3 damage!",
                    event: "feed",
                },
            ],
            entities: [
                {
                    event: "entities",
                    players: [
                        {
                            player: playerTwo.player,
                            hp: 2,
                        },
                    ],
                    monsters: [],
                    items: [],
                    op: "upsert",
                },
            ],
            cta: [],
            action: [
                {
                    action: "attack",
                    source: playerOne.player,
                    target: playerTwo.player,
                    event: "action",
                },
            ],
        });

        // Drop weapon
        await crossoverCmdDrop(
            {
                item: weapon.item,
            },
            { Cookie: playerOneCookies },
        );
        await sleep(MS_PER_TICK * 2);

        // Check weapon location
        weapon = (await fetchEntity(weapon.item)) as ItemEntity;
        expect(weapon).toMatchObject({
            loc: playerOne.loc,
            locT: "geohash",
            locI: "@",
            own: playerOne.player,
            cfg: playerOne.player,
        });
    });
});
