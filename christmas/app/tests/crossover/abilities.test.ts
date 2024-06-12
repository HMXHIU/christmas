import { patchEffectWithVariables } from "$lib/crossover/world/abilities";
import {
    MS_PER_TICK,
    TICKS_PER_TURN,
    abilities,
} from "$lib/crossover/world/settings";
import {
    consumeResources,
    performAbility,
    recoverAp,
} from "$lib/server/crossover";
import type { PlayerEntity } from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import { expect, test, vi } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer } from "./utils";

vi.mock("$lib/crossover/world", async (module) => {
    return { ...((await module()) as object), MS_PER_TICK: 10 };
});

test("Test Abilities", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Create players
    const playerOneName = "Gandalf";
    const playerOneGeohash = "gbsuv777";
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });
    const playerTwoName = "Saruman";
    const playerTwoGeohash = "gbsuv77e";
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });

    // Test AP recovery
    playerOne = (await consumeResources(playerOne as PlayerEntity, {
        ap: 100,
    })) as PlayerEntity;
    expect(playerOne.ap).toBe(0);
    await sleep(MS_PER_TICK * (TICKS_PER_TURN + 1));
    playerOne = (await recoverAp(playerOne as PlayerEntity)) as PlayerEntity;
    expect(playerOne.ap).toBe(4);

    // Test ability out of range (scratch has 0 range)
    expect(
        await performAbility({
            self: playerOne as PlayerEntity,
            target: playerTwo as PlayerEntity,
            ability: abilities.scratch.ability,
        }),
    ).toMatchObject({
        self: {
            player: playerOneWallet.publicKey.toBase58(),
            name: "Gandalf",
            lgn: true,
            loc: playerOne.loc,
            lvl: playerOne.lvl,
            hp: playerOne.hp,
            mp: playerOne.mp,
            st: playerOne.st,
            ap: playerOne.ap,
            dbuf: [],
            buf: [],
        },
        target: {
            player: playerTwoWallet.publicKey.toBase58(),
            name: "Saruman",
            lgn: true,
            loc: playerTwo.loc,
            lvl: playerOne.lvl,
            hp: playerOne.hp,
            mp: playerOne.mp,
            st: playerOne.st,
            ap: playerOne.ap,
            dbuf: [],
            buf: [],
        },
        status: "failure",
        message: "Target is out of range",
    });

    // Test ability in range
    playerTwo.loc = playerOne.loc;
    const playerTwoHp = playerTwo.hp;
    const playerOneSt = playerOne.st;
    const playerOneAp = playerOne.ap;
    await expect(
        performAbility({
            self: playerOne as PlayerEntity,
            target: playerTwo as PlayerEntity,
            ability: abilities.scratch.ability,
        }),
    ).resolves.toMatchObject({
        self: {
            player: playerOneWallet.publicKey.toBase58(),
            name: "Gandalf",
            lgn: true,
            loc: playerOne.loc,
            lvl: playerOne.lvl,
            hp: playerOne.hp,
            mp: playerOne.mp,
            st: playerOneSt - abilities.scratch.st,
            ap: playerOneAp - abilities.scratch.ap,
            dbuf: [],
            buf: [],
        },
        target: {
            player: playerTwoWallet.publicKey.toBase58(),
            name: "Saruman",
            lgn: true,
            loc: playerTwo.loc,
            lvl: playerTwo.lvl,
            hp: playerTwoHp - 1, // scratch does 1 damage
            mp: playerTwo.mp,
            st: playerTwo.st,
            ap: playerTwo.ap,
            dbuf: [],
            buf: [],
        },
        status: "success",
        message: "",
    });

    // Test not enough action points
    playerOne.ap = 0;
    playerOne.apclk = Date.now();
    await expect(
        performAbility({
            self: playerOne as PlayerEntity,
            target: playerTwo as PlayerEntity,
            ability: abilities.scratch.ability,
        }),
    ).resolves.toMatchObject({
        self: {
            player: playerOneWallet.publicKey.toBase58(),
            name: "Gandalf",
            lgn: true,
            loc: playerOne.loc,
            lvl: playerOne.lvl,
            hp: playerOne.hp,
            mp: playerOne.mp,
            st: playerOne.st,
            ap: playerOne.ap,
            dbuf: [],
            buf: [],
        },
        target: {
            player: playerTwoWallet.publicKey.toBase58(),
            name: "Saruman",
            lgn: true,
            loc: playerTwo.loc,
            lvl: playerTwo.lvl,
            hp: playerTwo.hp,
            mp: playerTwo.mp,
            st: playerTwo.st,
            ap: playerTwo.ap,
            dbuf: [],
            buf: [],
        },
        status: "failure",
        message: "Not enough action points to scratch.",
    });

    // Test patchEffectWithVariables
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

    // Test teleport
    playerOne.ap = 20;
    playerOne.mp = 20;
    playerOne.loc = ["gbsuv77w"];
    await expect(
        performAbility({
            self: playerOne as PlayerEntity,
            target: playerTwo as PlayerEntity,
            ability: abilities.teleport.ability,
        }),
    ).resolves.toMatchObject({
        self: {
            player: playerOneWallet.publicKey.toBase58(),
            name: "Gandalf",
            loc: playerTwo.loc,
        },
        target: {
            player: playerTwoWallet.publicKey.toBase58(),
            name: "Saruman",
            loc: playerTwo.loc,
        },
        status: "success",
        message: "",
    });
});
