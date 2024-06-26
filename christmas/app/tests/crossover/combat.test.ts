import { stream } from "$lib/crossover";
import { abilities } from "$lib/crossover/world/abilities";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { sanctuariesByRegion } from "$lib/crossover/world/world";
import { spawnMonster } from "$lib/server/crossover";
import { initializeClients } from "$lib/server/crossover/redis";
import type {
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { beforeAll, describe, expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import {
    buffEntity,
    createRandomPlayer,
    generateRandomGeohash,
    testMonsterPerformAbilityOnPlayer,
    testPlayerPerformAbilityOnMonster,
    waitForEventData,
} from "./utils";

const region = String.fromCharCode(...getRandomRegion());
const playerOneGeohash = generateRandomGeohash(6, "h9");
let playerOne: Player;
let playerOneCookies: string;
let goblin: Monster;
let playerOneStream: any;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Create player
    [, playerOneCookies, playerOne] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: "Gandalf",
    });

    // Create stream
    [playerOneStream] = await stream({
        Cookie: playerOneCookies,
    });
    await expect(
        waitForEventData(playerOneStream, "feed"),
    ).resolves.toMatchObject({
        type: "system",
        message: "started",
    });

    // Spawn monsters
    goblin = await spawnMonster({
        geohash: playerOneGeohash,
        beast: "goblin",
        level: 1,
    });
});

describe("Combat Tests", () => {
    test("Player gains LUs after killing monster", async () => {
        // Give player enough mana to cast disintegrate
        playerOne = (await buffEntity(playerOne.player, {
            mp: 2000,
            level: 1000,
        })) as PlayerEntity;

        var [res, { player, playerBefore, monster, monsterBefore }] =
            await testPlayerPerformAbilityOnMonster({
                player: playerOne,
                monster: goblin,
                ability: abilities.disintegrate.ability,
                cookies: playerOneCookies,
                stream: playerOneStream,
            });

        expect(res).toBe("success");

        // Check player gained LUs
        const { lumina, umbra } = monsterLUReward({
            level: goblin.lvl,
            beast: goblin.beast,
        });

        expect(player).toMatchObject({
            player: playerOne.player,
            lum: playerBefore.lum + lumina,
            umb: playerBefore.umb + umbra,
        });
    });

    test("Player respawns when killed by monster", async () => {
        // Reset playerOne to level 1
        playerOne = (await buffEntity(playerOne.player, {
            level: 1,
        })) as PlayerEntity;

        // Give monster enough mana to cast disintegrate
        goblin = (await buffEntity(goblin.monster, {
            mp: 2000,
            level: 1000,
        })) as MonsterEntity;

        var [res, { player, playerBefore, monster, monsterBefore }] =
            await testMonsterPerformAbilityOnPlayer({
                monster: goblin as MonsterEntity,
                player: playerOne as PlayerEntity,
                ability: abilities.disintegrate.ability,
                stream: playerOneStream,
            });

        // Should respawn at sanctuary
        const respawnGeohash = sanctuariesByRegion[player.rgn].geohash;
        expect(player.loc).toMatchObject([respawnGeohash]);

        // TODO: Should respawn with full health after death timer
        // expect(player.hp).toBeGreaterThan(0);
    });
});
