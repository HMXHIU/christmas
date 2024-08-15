import { stream } from "$lib/crossover/client";
import { patchEffectWithVariables } from "$lib/crossover/world/abilities";
import { playerAttributes, playerStats } from "$lib/crossover/world/player";
import { MS_PER_TICK, TICKS_PER_TURN } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { entityActualAp } from "$lib/crossover/world/utils";
import { consumeResources } from "$lib/server/crossover";
import { initializeClients, saveEntity } from "$lib/server/crossover/redis";
import type {
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import type NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import {
    createRandomPlayer,
    testPlayerPerformAbilityOnPlayer,
    waitForEventData,
} from "./utils";

let region = String.fromCharCode(...getRandomRegion());
const playerOneName = "Gandalf";
const playerOneGeohash = "gbsuv777";
const playerTwoName = "Saruman";
const playerTwoGeohash = "gbsuv77g";
let playerOne: Player, playerTwo: Player;
let playerOneWallet: NodeWallet, playerTwoWallet: NodeWallet;
let playerOneCookies: string, playerTwoCookies: string;
let playerOneStream: EventTarget, playerTwoStream: EventTarget;
let playerOneCloseStream: () => void, playerTwoCloseStream: () => void;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Create players
    [playerOneWallet, playerOneCookies, playerOne] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: playerOneName,
    });

    [playerTwoWallet, playerTwoCookies, playerTwo] = await createRandomPlayer({
        region,
        geohash: playerTwoGeohash,
        name: playerTwoName,
    });

    // Create streams
    [playerOneStream, playerOneCloseStream] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
    [playerTwoStream, playerTwoCloseStream] = await stream({
        Cookie: playerTwoCookies,
    });
    await expect(
        waitForEventData(playerTwoStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });
});

beforeEach(async () => {
    // Reset players' state if necessary
    playerOne = {
        ...playerOne,
        loc: [playerOneGeohash],
        ...playerStats({ level: playerOne.lvl }),
    };
    playerTwo = {
        ...playerTwo,
        loc: [playerTwoGeohash],
        ...playerStats({ level: playerTwo.lvl }),
    };
    playerOne = (await saveEntity(playerOne as PlayerEntity)) as Player;
    playerTwo = (await saveEntity(playerTwo as PlayerEntity)) as Player;
});

describe("Abilities Tests", () => {
    test("AP Recovery", async () => {
        playerOne = (await consumeResources(playerOne as PlayerEntity, {
            ap: 100,
        })) as PlayerEntity;
        expect(playerOne.ap).toBe(0);
        await sleep(MS_PER_TICK * (TICKS_PER_TURN + 1));

        playerOne.ap = entityActualAp(playerOne, {
            attributes: playerAttributes(playerOne),
        });

        expect(playerOne.ap).toBe(4);
    });

    test("Ability out of range", async () => {
        var [result, { selfBefore, targetBefore }] =
            await testPlayerPerformAbilityOnPlayer({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                ability: abilities.scratch.ability,
                selfCookies: playerOneCookies,
                selfStream: playerOneStream,
                targetStream: playerTwoStream,
            });

        expect(result).toBe("outOfRange");
        expect(selfBefore).toMatchObject(playerOne);
        expect(targetBefore).toMatchObject(playerTwo);
    });

    test("Ability in range", async () => {
        playerTwo.loc = playerOne.loc;
        playerTwo = (await saveEntity(playerTwo as PlayerEntity)) as Player;

        var [result, { self, target, selfBefore, targetBefore }] =
            await testPlayerPerformAbilityOnPlayer({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                ability: abilities.scratch.ability,
                selfCookies: playerOneCookies,
                selfStream: playerOneStream,
                targetStream: playerTwoStream,
            });

        expect(result).toBe("success");
        expect(self).toMatchObject({
            st: selfBefore.st - abilities.scratch.st,
            mp: selfBefore.mp - abilities.scratch.mp,
            hp: selfBefore.hp - abilities.scratch.hp,
        });
        expect(target).toMatchObject({
            hp: targetBefore.hp - 1, // scratch does 1 damage
        });
    });

    test("Not enough action points", async () => {
        playerOne.ap = 0;
        playerOne.apclk = Date.now();
        playerOne = (await saveEntity(playerOne as PlayerEntity)) as Player;

        var [result, { self, target, selfBefore, targetBefore }] =
            await testPlayerPerformAbilityOnPlayer({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                ability: abilities.scratch.ability,
                selfCookies: playerOneCookies,
                selfStream: playerOneStream,
                targetStream: playerTwoStream,
            });

        expect(result).toBe("insufficientResources");
        expect(selfBefore).toMatchObject(playerOne);
        expect(targetBefore).toMatchObject(playerTwo);
    });

    test("Teleport ability", async () => {
        playerOne.ap = 20;
        playerOne.mp = 20;
        playerOne = (await saveEntity(playerOne as PlayerEntity)) as Player;

        var [result, { self, target, selfBefore, targetBefore }] =
            await testPlayerPerformAbilityOnPlayer({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                ability: abilities.teleport.ability,
                selfCookies: playerOneCookies,
                selfStream: playerOneStream,
                targetStream: playerTwoStream,
            });

        expect(result).toBe("success");
        expect(self.loc[0]).toBe(target.loc[0]);
    });

    test("Patch effect with variables", () => {
        const teleportEffect = abilities.teleport.procedures[0][1];
        const actualEffect = patchEffectWithVariables({
            self: playerOne as PlayerEntity,
            target: playerTwo as PlayerEntity,
            effect: teleportEffect,
        });
        expect(actualEffect).toMatchObject({
            target: "self",
            states: {
                state: "loc",
                value: playerTwo.loc,
                op: "change",
            },
        });
    });
});
