import type { PlayerEntity } from "$lib/crossover/types";
import { patchEffectWithVariables } from "$lib/crossover/world/abilities";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { initializeClients } from "$lib/server/crossover/redis";
import { saveEntity } from "$lib/server/crossover/redis/utils";
import { beforeEach, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    generateRandomGeohash,
    resetEntityResources,
    testPlayerPerformAbilityOnPlayer,
} from "./utils";

await initializeClients(); // create redis repositories

let {
    geohash,
    playerOne,
    playerOneCookies,
    playerTwoStream,
    playerOneStream,
    playerTwo,
} = await createGandalfSarumanSauron();

beforeEach(async () => {
    playerOne.loc = [geohash];
    playerTwo.loc = [geohash];
    resetEntityResources(playerOne, playerTwo);
});

describe("Abilities Tests", () => {
    test("Ability out of range", async () => {
        // Move playerTwo away
        playerTwo.loc = [
            generateRandomGeohash(worldSeed.spatial.unit.precision, "h9"),
        ];
        playerTwo = await saveEntity(playerTwo);

        var [result, { selfBefore, targetBefore }] =
            await testPlayerPerformAbilityOnPlayer({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                ability: abilities.bruise.ability,
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
        playerTwo = await saveEntity(playerTwo);

        var [result, { self, target, selfBefore, targetBefore }] =
            await testPlayerPerformAbilityOnPlayer({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                ability: abilities.bruise.ability,
                selfCookies: playerOneCookies,
                selfStream: playerOneStream,
                targetStream: playerTwoStream,
            });

        expect(result).toBe("success");
        expect(self).toMatchObject({
            mnd: selfBefore.mnd - (abilities.bruise.cost.mnd ?? 0),
        });
        expect(target).toMatchObject({
            hp: targetBefore.hp - 1, // bruise does 1 damage
        });
    });

    test("Not enough action points", async () => {
        playerOne.ap = 0;
        playerOne.apclk = Date.now();
        playerOne = await saveEntity(playerOne);

        var [result, { self, target, selfBefore, targetBefore }] =
            await testPlayerPerformAbilityOnPlayer({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                ability: abilities.bruise.ability,
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
        playerOne = await saveEntity(playerOne);

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
        // Test teleport
        const teleportEffect = abilities.teleport.procedures[0][1];
        const actualEffect = patchEffectWithVariables({
            self: playerOne as PlayerEntity,
            target: playerTwo as PlayerEntity,
            effect: teleportEffect,
        });
        expect(actualEffect).toMatchObject({
            target: "self",
            states: {
                loc: {
                    value: playerTwo.loc, // patch array
                    op: "change",
                },
                locT: {
                    value: playerTwo.locT, // patch string
                    op: "change",
                },
            },
        });

        // Test hpSwap
        playerOne.hp = 10;
        playerTwo.hp = 20;
        const swapEffect1 = abilities.hpSwap.procedures[0][1];
        const swapEffect2 = abilities.hpSwap.procedures[1][1];
        expect(
            patchEffectWithVariables({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                effect: swapEffect1,
            }),
        ).toMatchObject({
            target: "self",
            states: {
                hp: {
                    value: playerTwo.hp, // patch number
                    op: "change",
                },
            },
        });
        expect(
            patchEffectWithVariables({
                self: playerOne as PlayerEntity,
                target: playerTwo as PlayerEntity,
                effect: swapEffect2,
            }),
        ).toMatchObject({
            target: "target",
            states: {
                hp: {
                    value: playerOne.hp, // patch number
                    op: "change",
                },
            },
        });
    });
});
