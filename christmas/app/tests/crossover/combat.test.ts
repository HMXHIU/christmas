import { crossoverCmdEquip, crossoverCmdTake, stream } from "$lib/crossover";
import { abilities } from "$lib/crossover/world/abilities";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { compendium } from "$lib/crossover/world/compendium";
import { playerStats } from "$lib/crossover/world/player";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { sanctuariesByRegion } from "$lib/crossover/world/world";
import { spawnItem, spawnMonster } from "$lib/server/crossover/dungeonMaster";
import {
    fetchEntity,
    initializeClients,
    saveEntity,
} from "$lib/server/crossover/redis";
import type {
    Item,
    ItemEntity,
    Monster,
    MonsterEntity,
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { sleep } from "$lib/utils";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import {
    buffEntity,
    createRandomPlayer,
    generateRandomGeohash,
    testMonsterPerformAbilityOnPlayer,
    testPlayerPerformAbilityOnMonster,
    testPlayerUseItemOnMonster,
    testPlayerUseItemOnPlayer,
    waitForEventData,
} from "./utils";

const region = String.fromCharCode(...getRandomRegion());
const playerOneGeohash = generateRandomGeohash(8, "h9");
let playerOne: Player;
let playerTwo: Player;
let playerOneCookies: string;
let playerTwoCookies: string;
let goblin: Monster;
let woodenClub: Item;
let playerOneStream: any;
let playerTwoStream: any;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Create players
    [, playerOneCookies, playerOne] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: "Gandalf",
    });
    [, playerTwoCookies, playerTwo] = await createRandomPlayer({
        region,
        geohash: playerOneGeohash,
        name: "Saruman",
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
    [playerTwoStream] = await stream({
        Cookie: playerTwoCookies,
    });
    await expect(
        waitForEventData(playerTwoStream, "feed"),
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

beforeEach(async () => {
    // Reset items' state if necessary
    woodenClub.chg = compendium[woodenClub.prop].charges;
    woodenClub.dur = compendium[woodenClub.prop].durability;
    woodenClub = (await saveEntity(woodenClub as ItemEntity)) as Item;

    // Reset players' state if necessary
    playerOne = {
        ...playerOne,
        loc: [playerOneGeohash],
        ...playerStats({ level: playerOne.lvl }),
    };
    playerTwo = {
        ...playerTwo,
        loc: [playerOneGeohash],
        ...playerStats({ level: playerTwo.lvl }),
    };
    playerOne = (await saveEntity(playerOne as PlayerEntity)) as Player;
    playerTwo = (await saveEntity(playerTwo as PlayerEntity)) as Player;
});

describe("Combat Tests", () => {
    test("Player use item on player", async () => {
        var [
            result,
            { self, target, selfBefore, targetBefore, item, itemBefore },
        ] = await testPlayerUseItemOnPlayer({
            self: playerOne as Player,
            target: playerTwo as Player,
            item: woodenClub as Item,
            utility: compendium[woodenClub.prop].utilities.swing.utility,
            selfCookies: playerOneCookies,
            selfStream: playerOneStream,
            targetStream: playerTwoStream,
        });
        expect(result).toBe("success");

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
        expect(target).toMatchObject({
            player: target.player,
            hp: targetBefore.hp - 1, // swing does 1 damage
        });
    });

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
        expect(result).toBe("success");

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
    });

    test("Player gains LUs after killing monster", async () => {
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
        console.log(JSON.stringify(playerOne, null, 2));

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
