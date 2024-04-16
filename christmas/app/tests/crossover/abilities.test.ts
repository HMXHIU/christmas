import { patchEffectWithVariables } from "$lib/crossover/world/abilities";
import { abilities } from "$lib/crossover/world/settings";
import { performAbility } from "$lib/server/crossover";
import type { PlayerEntity } from "$lib/server/crossover/redis/entities";
import { expect, test, vi } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer } from "./utils";

vi.mock("$lib/crossover/world", async (module) => {
    return { ...((await module()) as object), MS_PER_TICK: 10 };
});

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
            location: playerOne.location,
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
            location: playerTwo.location,
            level: playerOne.level,
            hp: playerOne.hp,
            mp: playerOne.mp,
            st: playerOne.st,
            ap: playerOne.ap,
            debuffs: [],
            buffs: [],
        },
        status: "failure",
        message: "Target out of range",
    });

    // Test ability in range
    playerTwo.location = playerOne.location;
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
            location: playerOne.location,
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
            location: playerTwo.location,
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
            location: playerOne.location,
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
            location: playerTwo.location,
            level: playerTwo.level,
            hp: playerTwo.hp,
            mp: playerTwo.mp,
            st: playerTwo.st,
            ap: playerTwo.ap,
            debuffs: [],
            buffs: [],
        },
        status: "failure",
        message: "Not enough resources to perform ability",
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
            state: "location",
            value: playerTwo.location,
            op: "change",
        },
    });

    // Test teleport
    playerOne.ap = 20;
    playerOne.mp = 20;
    playerOne.location = ["gbsuv77w"];
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
            location: playerTwo.location,
        },
        target: {
            player: playerTwoWallet.publicKey.toBase58(),
            name: "Saruman",
            location: playerTwo.location,
        },
        status: "success",
        message: "",
    });
});
