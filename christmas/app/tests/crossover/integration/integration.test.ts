import {
    crossoverCmdMove,
    crossoverCmdPerformAbility,
    crossoverCmdSay,
} from "$lib/crossover/client";
import type { Item, ItemEntity, PlayerEntity } from "$lib/crossover/types";
import { itemAttibutes } from "$lib/crossover/world/compendium";
import { entityStats } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { configureItem } from "$lib/server/crossover/actions/item";
import { spawnItemAtGeohash } from "$lib/server/crossover/dungeonMaster";
import {
    fetchEntity,
    initializeClients,
    saveEntity,
} from "$lib/server/crossover/redis";
import { sleep } from "$lib/utils";
import type NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import ngeohash from "ngeohash";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
    buffEntity,
    createGandalfSarumanSauron,
    generateRandomGeohash,
    testPlayerConfigureItem,
    testPlayerCreateItem,
    testPlayerDropItem,
    testPlayerEquipItem,
    testPlayerPerformAbilityOnPlayer,
    testPlayerTakeItem,
    testPlayerUnequipItem,
    testPlayerUseItem,
    testPlayerUseItemOnPlayer,
    waitForEventData,
} from "../utils";

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
    test("Test Say", async () => {
        // playerOne say
        await crossoverCmdSay(
            { message: "Hello, world!" },
            { Cookie: playerOneCookies },
        );

        // playerThree should receive message (same tile)
        await expect(
            waitForEventData(playerThreeStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                name: playerOne.name,
                cmd: "say",
                message: "Hello, world!",
            },
        });

        // playerOne should receive message (self)
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                name: playerOne.name,
                cmd: "say",
                message: "Hello, world!",
            },
        });

        // playerTwo should not receive the message (different tile)
        await expect(
            waitForEventData(playerTwoStream, "feed"),
        ).rejects.toThrowError("Timeout occurred while waiting for event");
    });

    test("Test Move", async () => {
        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        const north = ngeohash.neighbor(playerOne.loc[0], [1, 0]);

        // playerOne move north
        await crossoverCmdMove({ path: ["n"] }, { Cookie: playerOneCookies });

        // playerOne & playerThree should be informed of playerOne new location
        await expect(
            waitForEventData(playerThreeStream, "entities"),
        ).resolves.toMatchObject({
            players: [
                {
                    player: playerOne.player,
                    loc: [north],
                },
            ],
            op: "upsert",
            event: "entities",
        });
        await expect(
            waitForEventData(playerOneStream, "entities"),
        ).resolves.toMatchObject({
            players: [
                {
                    player: playerOne.player,
                    loc: [north],
                },
            ],
            op: "upsert",
            event: "entities",
        });
    });

    test("Test Abilities", async () => {
        // Test out of range (playerOne scratch playerTwo)
        await crossoverCmdPerformAbility(
            {
                target: playerTwo.player,
                ability: abilities.scratch.ability,
            },
            { Cookie: playerOneCookies },
        );
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            event: "feed",
            type: "error",
            message: "Target is out of range",
        });
        await sleep(MS_PER_TICK * 2);

        // Test out of resources (playerOne teleport to playerTwo)
        await crossoverCmdPerformAbility(
            {
                target: playerTwo.player,
                ability: abilities.teleport.ability,
            },
            { Cookie: playerOneCookies },
        );
        await expect(
            waitForEventData(playerOneStream, "feed"),
        ).resolves.toMatchObject({
            event: "feed",
            type: "error",
            message: "Not enough mana points to teleport.",
        });
        await sleep(MS_PER_TICK * 2);

        // Buff `playerOne` with enough resources to teleport
        playerOne = (await buffEntity(playerOne.player, {
            ...entityStats(playerOne),
        })) as PlayerEntity;

        // TODO: minified entity for stat changes, playerTwo should receive playerOne location
        const [result, { selfBefore, self }] =
            await testPlayerPerformAbilityOnPlayer({
                self: playerOne,
                target: playerTwo,
                ability: abilities.teleport.ability,
                selfStream: playerOneStream,
                targetStream: playerTwoStream,
                selfCookies: playerOneCookies,
            });
        expect(result).equal("success");
        expect(selfBefore.mp - self.mp).equal(abilities.teleport.mp);
        expect(selfBefore.ap - self.ap).equal(abilities.teleport.ap);
        expect(self.loc[0]).equal(playerTwo.loc[0]);
    });

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

    test("Test Complex Items", async () => {
        // Create portalOne at playerOne (public owner)
        let portalOne = (await spawnItemAtGeohash({
            geohash: playerOne.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.portal.prop,
        })) as Item;

        // Create portalTwo at playerTwo (public owner)
        let portalTwo = (await spawnItemAtGeohash({
            geohash: playerTwo.loc[0],
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            prop: compendium.portal.prop,
        })) as Item;

        // Configure portals to point to each other (public anyone can configure)
        portalOne = await configureItem(
            playerOne as PlayerEntity,
            portalOne.item,
            {
                target: portalTwo.item,
            },
        );
        await sleep(MS_PER_TICK * 2);
        portalTwo = await configureItem(
            playerTwo as PlayerEntity,
            portalTwo.item,
            {
                target: portalOne.item,
            },
        );
        await sleep(MS_PER_TICK * 2);

        // playerOne uses portalOne to teleport to portalTwo
        var [result, { self, selfBefore, item, itemBefore }] =
            await testPlayerUseItem({
                self: playerOne,
                item: portalOne,
                utility: compendium.portal.utilities.teleport.utility,
                cookies: playerOneCookies,
                stream: playerOneStream,
            });
        expect(result).equal("success");
        expect(self.loc[0]).equal(portalTwo.loc[0]);
        expect(itemBefore.chg - item.chg).equal(
            compendium.portal.utilities.teleport.cost.charges,
        );

        // playerOne uses portalTwo to teleport to portalOne
        var [result, { self, selfBefore, item, itemBefore }] =
            await testPlayerUseItem({
                self: playerOne,
                item: portalTwo,
                utility: compendium.portal.utilities.teleport.utility,
                cookies: playerOneCookies,
                stream: playerOneStream,
            });
        expect(result).equal("success");
        expect(self.loc[0]).equal(portalOne.loc[0]);
        expect(itemBefore.chg - item.chg).equal(
            compendium.portal.utilities.teleport.cost.charges,
        );
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
