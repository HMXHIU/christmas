import {
    abilities,
    fillInEffectVariables,
    performAbility,
} from "$lib/crossover/world/abilities";
import type { PlayerEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer } from "./utils";

test("Test Abilities", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = "gbsuv777";
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = "gbsuv77e";
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });

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
            loggedIn: true,
            geohash: playerOne.geohash,
            level: playerOne.level,
            hp: playerOne.hp,
            mp: playerOne.mp,
            st: playerOne.st,
            ap: playerOne.ap,
            debuffs: [],
            buffs: [],
        },
        target: {
            player: playerTwoWallet.publicKey.toBase58(),
            name: "Saruman",
            loggedIn: true,
            geohash: playerTwo.geohash,
            level: playerOne.level,
            hp: playerOne.hp,
            mp: playerOne.mp,
            st: playerOne.st,
            ap: playerOne.ap,
            debuffs: [],
            buffs: [],
        },
        status: "failure",
        message: "Out of range",
    });

    // Test ability in range
    playerTwo.geohash = playerOne.geohash;
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
            loggedIn: true,
            geohash: playerOne.geohash,
            level: playerOne.level,
            hp: playerOne.hp,
            mp: playerOne.mp,
            st: playerOneSt - abilities.scratch.st,
            ap: playerOneAp - abilities.scratch.ap,
            debuffs: [],
            buffs: [],
        },
        target: {
            player: playerTwoWallet.publicKey.toBase58(),
            name: "Saruman",
            loggedIn: true,
            geohash: playerTwo.geohash,
            level: playerTwo.level,
            hp: playerTwoHp - 1, // scratch does 1 damage
            mp: playerTwo.mp,
            st: playerTwo.st,
            ap: playerTwo.ap,
            debuffs: [],
            buffs: [],
        },
        status: "success",
        message: "",
    });

    // Test not enough action points
    playerOne.ap = 0;
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
            loggedIn: true,
            geohash: playerOne.geohash,
            level: playerOne.level,
            hp: playerOne.hp,
            mp: playerOne.mp,
            st: playerOne.st,
            ap: playerOne.ap,
            debuffs: [],
            buffs: [],
        },
        target: {
            player: playerTwoWallet.publicKey.toBase58(),
            name: "Saruman",
            loggedIn: true,
            geohash: playerTwo.geohash,
            level: playerTwo.level,
            hp: playerTwo.hp,
            mp: playerTwo.mp,
            st: playerTwo.st,
            ap: playerTwo.ap,
            debuffs: [],
            buffs: [],
        },
        status: "failure",
        message: "Not enough AP",
    });

    // Test fillInEffectVariables
    const teleportEffect = abilities.teleport.procedures[0][1];
    const actualEffect = fillInEffectVariables({
        self: playerOne as PlayerEntity,
        target: playerTwo as PlayerEntity,
        effect: teleportEffect,
    });
    expect(actualEffect).toMatchObject({
        target: "self",
        states: {
            state: "geohash",
            value: playerTwo.geohash,
            op: "change",
        },
        variableSubstitute: true,
    });

    // Test teleport
    playerOne.ap = 20;
    playerOne.mp = 20;
    playerOne.geohash = "gbsuv77w";
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
            geohash: playerTwo.geohash,
        },
        target: {
            player: playerTwoWallet.publicKey.toBase58(),
            name: "Saruman",
            geohash: playerTwo.geohash,
        },
        status: "success",
        message: "",
    });
});
