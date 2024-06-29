import { crossoverCmdEquip, crossoverCmdTake, stream } from "$lib/crossover";
import { abilities } from "$lib/crossover/world/abilities";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { compendium } from "$lib/crossover/world/compendium";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { sanctuariesByRegion } from "$lib/crossover/world/world";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import { fetchEntity, initializeClients } from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import { beforeAll, describe, expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import {
    buffEntity,
    createRandomPlayer,
    generateRandomGeohash,
    testMonsterPerformAbilityOnPlayer,
    testPlayerPerformAbilityOnMonster,
    testPlayerUseItemOnMonster,
    waitForEventData,
} from "./utils";

const region = String.fromCharCode(...getRandomRegion());
const playerOneGeohash = generateRandomGeohash(6, "h9");
let playerOne: Player;
let playerOneCookies: string;
let goblin: Monster;
let woodenClub: Item;
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

    // Spawn weapon
    woodenClub = await spawnItem({
        geohash: playerOne.loc[0],
        prop: compendium.woodenclub.prop,
        owner: playerOne.player,
        configOwner: playerOne.player,
    });

    // Take & equip weapon
    await crossoverCmdTake(
        { item: woodenClub.item },
        { Cookie: playerOneCookies },
    );
    await sleep(MS_PER_TICK * 2); // wait for item to be updated
    await crossoverCmdEquip(
        {
            item: woodenClub.item,
            slot: "rh",
        },
        { Cookie: playerOneCookies },
    );
    await sleep(MS_PER_TICK * 2); // wait for item to be updated
    woodenClub = (await fetchEntity(woodenClub.item)) as ItemEntity;
});

describe("Combat Tests", () => {
    test("Player use item on monster", async () => {
        var [
            result,
            { player, monster, playerBefore, monsterBefore, item, itemBefore },
        ] = await testPlayerUseItemOnMonster({
            player: playerOne as Player,
            monster: goblin as Monster,
            item: woodenClub as Item,
            utility: compendium[woodenClub.prop].utilities.swing.utility,
            cookies: playerOneCookies,
            stream: playerOneStream,
        });

        // Check item used charges and durability
        expect(item).toMatchObject({
            item: woodenClub.item,
            chg:
                itemBefore.chg -
                compendium[woodenClub.prop].utilities.swing.cost.charges,
            dur:
                itemBefore.dur -
                compendium[woodenClub.prop].utilities.swing.cost.durability,
        });

        // Check monster damaged
        expect(monster).toMatchObject({
            monster: goblin.monster,
            hp: monsterBefore.hp - 1, // swing does 1 damage
        });

        expect(result).toBe("success");
    });

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
