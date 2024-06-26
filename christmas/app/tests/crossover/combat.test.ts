import { stream } from "$lib/crossover";
import { abilities } from "$lib/crossover/world/abilities";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { spawnMonster } from "$lib/server/crossover";
import { fetchEntity, initializeClients } from "$lib/server/crossover/redis";
import type {
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import {
    buffEntity,
    createRandomPlayer,
    generateRandomGeohash,
    testMonsterPerformAbilityOnPlayer,
    testPlayerPerformAbilityOnMonster,
    waitForEventData,
} from "./utils";

test("Test Combat", async () => {
    await initializeClients(); // create redis repositories

    const region = String.fromCharCode(...getRandomRegion());

    // Create players
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(6, "h9");
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Create streams
    const [playerOneStream, playerOneCloseStream] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // Spawn monsters
    let goblin = await spawnMonster({
        geohash: playerOneGeohash,
        beast: "goblin",
        level: 1,
    });

    /*
     * Test gain LUs after killing monster
     */

    // Give player enough mana to cast disintegrate
    playerOne = (await buffEntity(playerOne.player, {
        mp: 2000,
        level: 1000,
    })) as PlayerEntity;

    // Perform ability on target
    let playerBefore = { ...playerOne };
    await testPlayerPerformAbilityOnMonster({
        player: playerOne,
        monster: goblin,
        ability: abilities.disintegrate.ability,
        cookies: playerOneCookies,
        stream: playerOneStream,
    });

    // Check player gained LUs
    playerOne = (await fetchEntity(playerOne.player)) as Player;
    const { lumina, umbra } = monsterLUReward({
        level: goblin.lvl,
        beast: goblin.beast,
    });
    expect(playerOne).toMatchObject({
        player: playerOne.player,
        lum: playerBefore.lum + lumina,
        umb: playerBefore.umb + umbra,
    });

    /*
     * Test player respawn when monster kills player
     */

    // Rest playerOne to level 1
    playerOne = (await buffEntity(playerOne.player, {
        level: 1,
    })) as PlayerEntity;

    // Give monster enough mana to cast disintegrate
    goblin = (await buffEntity(goblin.monster, {
        mp: 2000,
        level: 1000,
    })) as MonsterEntity;

    // Perform ability on target
    playerBefore = { ...playerOne };
    await testMonsterPerformAbilityOnPlayer({
        monster: goblin,
        player: playerOne as PlayerEntity,
        ability: abilities.disintegrate.ability,
        stream: playerOneStream,
    });
});
