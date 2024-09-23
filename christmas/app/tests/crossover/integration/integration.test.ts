import type { ItemEntity, PlayerEntity } from "$lib/crossover/types";
import { itemAttibutes } from "$lib/crossover/world/compendium";
import { entityStats } from "$lib/crossover/world/entity";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import {
    fetchEntity,
    initializeClients,
    saveEntity,
} from "$lib/server/crossover/redis";
import { sleep } from "$lib/utils";
import type NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createGandalfSarumanSauron, generateRandomGeohash } from "../utils";

let region: string;
let geohash: string;
let playerOne: PlayerEntity;
let playerTwo: PlayerEntity;
let playerThree: PlayerEntity;
let playerOneCookies: string;
let playerTwoCookies: string;
let playerThreeCookies: string;
let playerOneStream: EventTarget;
let playerTwoStream: EventTarget;
let playerThreeStream: EventTarget;
let playerOneWallet: NodeWallet;
let playerTwoWallet: NodeWallet;
let playerThreeWallet: NodeWallet;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    ({
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
    } = await createGandalfSarumanSauron());

    // Test location geohash
    expect(playerOne.loc[0].length).toBe(worldSeed.spatial.unit.precision);
    expect(playerOne.loc[0].startsWith(geohash)).toBe(true);

    // Test stats
    expect(entityStats(playerOne)).toMatchObject({
        hp: 10,
        mp: 10,
        st: 10,
        ap: 4,
    });
});

beforeEach(async () => {
    geohash = generateRandomGeohash(8, "h9b");

    // playerOne and playerThree should be same location
    playerOne.loc = [geohash];
    playerOne = (await saveEntity(playerOne)) as PlayerEntity;

    playerThree.loc = [geohash];
    playerThree = (await saveEntity(playerThree)) as PlayerEntity;

    // Change playerTwo location away from playerOne & playerThree
    playerTwo.loc = [generateRandomGeohash(8, "h9r")];
    playerTwo = (await saveEntity(playerTwo)) as PlayerEntity;
});

describe("Integration Tests", () => {
    test("Test Create/Configure/Use Item", async () => {
        // Test create woodendoor
        var [result, { self, selfBefore, item: woodenDoor }] =
            await testPlayerCreateItem({
                self: playerOne,
                geohash: playerOne.loc[0],
                prop: compendium.woodendoor.prop,
                variables: {
                    [compendium.woodendoor.variables.doorsign.variable]:
                        "A custom door sign",
                },
                cookies: playerOneCookies,
                stream: playerOneStream,
            });
        expect(result).equal("success");
        expect(woodenDoor).toMatchObject({
            state: "closed",
            vars: { doorsign: "A custom door sign" },
            loc: playerOne.loc,
        });
        await sleep(MS_PER_TICK * 2);

        // Configure woodendoor
        var [
            result,
            { self, selfBefore, item: updatedWoodenDoor, itemBefore },
        ] = await testPlayerConfigureItem({
            self: playerOne,
            item: woodenDoor!,
            variables: {
                [compendium.woodendoor.variables.doorsign.variable]:
                    "A new door sign",
            },
            cookies: playerOneCookies,
            stream: playerOneStream,
        });
        expect(updatedWoodenDoor).toMatchObject({
            state: "closed",
            vars: { doorsign: "A new door sign" },
        });
        await sleep(MS_PER_TICK * 2);

        // Use (open) woodendoor
        var [result, { self, selfBefore, item, itemBefore }] =
            await testPlayerUseItem({
                self: playerOne,
                item: { ...woodenDoor, ...updatedWoodenDoor },
                utility: compendium.woodendoor.utilities.open.utility,
                cookies: playerOneCookies,
                stream: playerOneStream,
            });
        await sleep(MS_PER_TICK * 2);

        // Check item attributes
        expect(itemAttibutes(item)).toMatchObject({
            destructible: false,
            description: "A new door sign. The door is open.",
            variant: "default",
        });
    });

    test("Test Take/Equip/Use/Unequip/Drop Item", async () => {
        // Test create woodendoor
        var [result, { self, selfBefore, item: woodenClub }] =
            await testPlayerCreateItem({
                self: playerOne,
                geohash: playerOne.loc[0],
                prop: compendium.woodenclub.prop,
                cookies: playerOneCookies,
                stream: playerOneStream,
            });
        expect(result).equal("success");
        expect(woodenClub).toMatchObject({
            name: compendium.woodenclub.defaultName,
            prop: compendium.woodenclub.prop,
            loc: playerOne.loc,
            dur: 100,
            chg: 0,
            state: compendium.woodenclub.defaultState,
        });
        await sleep(MS_PER_TICK * 2);

        // Test owner
        woodenClub = (await fetchEntity(woodenClub?.item!)) as ItemEntity;
        expect(woodenClub).toMatchObject({
            own: playerOne.player, // playerOne owns the woodenclub
            cfg: playerOne.player, // playerOne can configure the woodenclub
        });

        // Test take woodenclub
        var [result, { item, itemBefore, self, selfBefore }] =
            await testPlayerTakeItem({
                self: playerOne,
                item: woodenClub,
                cookies: playerOneCookies,
                stream: playerOneStream,
            });
        woodenClub = { ...woodenClub, ...item };
        await sleep(MS_PER_TICK * 2);

        // Test equip woodenclub
        var [result, { item, itemBefore, self, selfBefore }] =
            await testPlayerEquipItem({
                self: playerOne,
                item: woodenClub,
                slot: "rh",
                cookies: playerOneCookies,
                stream: playerOneStream,
            });
        woodenClub = { ...woodenClub, ...item };
        await sleep(MS_PER_TICK * 2);

        // playerOne swing woodenClub at playerThree
        var [
            result,
            {
                self,
                selfBefore,
                target,
                targetBefore,
                item: updatedWoodenClub,
                itemBefore,
            },
        ] = await testPlayerUseItemOnPlayer({
            self: playerOne,
            target: playerThree,
            item: woodenClub,
            utility: compendium.woodenclub.utilities.swing.utility,
            selfCookies: playerOneCookies,
            selfStream: playerOneStream,
            targetStream: playerThreeStream,
        });
        woodenClub = { ...woodenClub, ...updatedWoodenClub };
        expect(result).equal("success");
        expect(targetBefore.hp - target.hp).equal(1);
        await sleep(MS_PER_TICK * 2);

        // playerOne unequip woodenClub
        var [result, { item, itemBefore, self, selfBefore }] =
            await testPlayerUnequipItem({
                self: playerOne,
                item: woodenClub,
                cookies: playerOneCookies,
                stream: playerOneStream,
            });
        woodenClub = { ...woodenClub, ...item };
        expect(result).equal("success");
        expect(item!.locT).equal("inv");
        expect(item!.loc[0]).equal(playerOne.player);
        await sleep(MS_PER_TICK * 2);

        // playerOne drop woodenClub
        var [result, { item, itemBefore, self, selfBefore }] =
            await testPlayerDropItem({
                self: playerOne,
                item: woodenClub,
                cookies: playerOneCookies,
                stream: playerOneStream,
            });
        expect(result).equal("success");
        expect(item!.locT).equal("geohash");
        expect(item!.loc[0]).equal(playerOne.loc[0]);
    });
});
