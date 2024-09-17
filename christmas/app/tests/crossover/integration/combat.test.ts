import {
    crossoverCmdEquip,
    crossoverCmdTake,
    stream,
} from "$lib/crossover/client";
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { entityStats } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    spawnItemAtGeohash,
    spawnMonster,
} from "$lib/server/crossover/dungeonMaster";
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
import { getRandomRegion } from "../../utils";
import {
    buffEntity,
    createRandomPlayer,
    generateRandomGeohash,
    testMonsterPerformAbilityOnPlayer,
    testPlayerPerformAbilityOnMonster,
    testPlayerUseItemOnMonster,
    testPlayerUseItemOnPlayer,
    waitForEventData,
} from "../utils";

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
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
        beast: "goblin",
    });

    // Spawn weapon
    woodenClub = await spawnItemAtGeohash({
        geohash: playerOne.loc[0],
        locationType: "geohash",
        locationInstance: LOCATION_INSTANCE,
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
        ...entityStats(playerOne),
    };
    playerTwo = {
        ...playerTwo,
        loc: [playerOneGeohash],
        ...entityStats(playerTwo),
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
        const { lum, umb } = monsterLUReward(goblin);

        expect(player).toMatchObject({
            player: playerOne.player,
            lum: playerBefore.lum + lum,
            umb: playerBefore.umb + umb,
        });
    });

    test("Player respawns when killed by monster", async () => {
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
    });
});
