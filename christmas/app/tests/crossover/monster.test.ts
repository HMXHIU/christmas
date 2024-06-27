import { geohashNeighbour } from "$lib/crossover/utils";
import { abilities } from "$lib/crossover/world/abilities";
import { monsterLUReward, monsterStats } from "$lib/crossover/world/bestiary";
import { compendium } from "$lib/crossover/world/compendium";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import {
    performMonsterActions,
    selectMonsterAbility,
} from "$lib/server/crossover/dungeonMaster";
import {
    initializeClients,
    monsterRepository,
    playerRepository,
} from "$lib/server/crossover/redis";
import type {
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { buffEntity, createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test Monster", async () => {
    await initializeClients(); // create redis repositories

    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(8, "h9");
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    /*
     * Test `spawnMonster`
     */

    // Spawn dragon (3x3 grid)
    const dragonGeohash = generateRandomGeohash(8, "h9"); // h9* is all ice (fully traversable)
    let dragon = await spawnMonster({
        geohash: dragonGeohash,
        beast: "dragon",
        level: 1,
    });
    expect(dragon).toMatchObject({
        loc: [
            // row 1
            dragonGeohash,
            geohashNeighbour(dragonGeohash, "e"),
            geohashNeighbour(geohashNeighbour(dragonGeohash, "e"), "e"),
            // row 2
            geohashNeighbour(dragonGeohash, "s"),
            geohashNeighbour(geohashNeighbour(dragonGeohash, "s"), "e"),
            geohashNeighbour(
                geohashNeighbour(geohashNeighbour(dragonGeohash, "s"), "e"),
                "e",
            ),
            // row 3
            geohashNeighbour(geohashNeighbour(dragonGeohash, "s"), "s"),
            geohashNeighbour(
                geohashNeighbour(geohashNeighbour(dragonGeohash, "s"), "s"),
                "e",
            ),
            geohashNeighbour(
                geohashNeighbour(
                    geohashNeighbour(geohashNeighbour(dragonGeohash, "s"), "s"),
                    "e",
                ),
                "e",
            ),
        ],
        locT: "geohash",
    });

    // Spawn goblin (1x1 grid)
    let goblin = await spawnMonster({
        geohash: playerOneGeohash,
        beast: "goblin",
        level: 1,
    });
    expect(goblin).toMatchObject({
        name: "goblin",
        beast: "goblin",
        loc: [playerOneGeohash],
        lvl: 1,
        hp: 20,
        mp: 20,
        st: 20,
        ap: 11,
        buf: [],
        dbuf: [],
    });

    // Test cannot spawn monster on collider
    const woodendoorGeohash = generateRandomGeohash(8, "h9");
    let woodendoor = (await spawnItem({
        geohash: woodendoorGeohash,
        prop: compendium.woodendoor.prop,
    })) as ItemEntity;
    await expect(
        spawnMonster({
            geohash: woodendoorGeohash,
            beast: "goblin",
            level: 1,
        }),
    ).rejects.toThrow(`Cannot spawn goblin at ${woodendoorGeohash}`);

    /*
     * Test `selectMonsterAbility`
     */

    // Test monster ability selection (offensive)
    const ability = selectMonsterAbility(goblin, playerOne as PlayerEntity);
    expect(ability).toBe(abilities.scratch.ability);

    // Test monster ability selection (healing)
    goblin.hp = goblin.hp / 2 - 1;
    const healingAbility = selectMonsterAbility(
        goblin,
        playerOne as PlayerEntity,
    );
    expect(healingAbility).toBe(abilities.bandage.ability);

    // Test do nothing when not enough ap
    goblin.ap = 0;
    const noAbility = selectMonsterAbility(goblin, playerOne as PlayerEntity);
    expect(noAbility).toBe(null);

    /*
     * Test `performMonsterActions`
     */

    // Reset `playerOne`, `goblin` stats
    goblin = (await buffEntity(goblin.monster, {
        level: goblin.lvl,
    })) as MonsterEntity;
    playerOne = (await buffEntity(playerOne.player, {
        level: playerOne.lvl,
    })) as PlayerEntity;

    // Test monster attacking player
    var hp = playerOne.hp;
    var ap = goblin.ap;
    await performMonsterActions([playerOne as PlayerEntity], [goblin]);

    playerOne = (await playerRepository.fetch(
        playerOne.player,
    )) as PlayerEntity;
    goblin = (await monsterRepository.fetch(goblin.monster)) as MonsterEntity;

    expect(playerOne.hp).toBe(hp - 1); // test player hp reduced by scatch damage
    expect(goblin.ap).toBe(ap - abilities.scratch.ap); // test monster ap reduced by scratch ap
});

test("Test Monster Stats", () => {
    /*
     * Test monster stats
     */
    expect(monsterStats({ level: 1, beast: "goblin" })).toMatchObject({
        ap: 11,
        hp: 20,
        mp: 20,
        st: 20,
    });
    expect(monsterStats({ level: 2, beast: "dragon" })).toMatchObject({
        ap: 20,
        hp: 370,
        mp: 296,
        st: 296,
    });

    /*
     * Test `monsterLUReward`
     */
    expect(monsterLUReward({ level: 1, beast: "goblin" })).toMatchObject({
        lumina: 1,
        umbra: 0,
    });
    expect(monsterLUReward({ level: 1, beast: "dragon" })).toMatchObject({
        lumina: 10,
        umbra: 0,
    });
    expect(monsterLUReward({ level: 1, beast: "giantSpider" })).toMatchObject({
        lumina: 1,
        umbra: 0,
    });
    expect(monsterLUReward({ level: 5, beast: "goblin" })).toMatchObject({
        lumina: 5,
        umbra: 0,
    });
    expect(monsterLUReward({ level: 5, beast: "dragon" })).toMatchObject({
        lumina: 50,
        umbra: 0,
    });
    expect(monsterLUReward({ level: 5, beast: "giantSpider" })).toMatchObject({
        lumina: 5,
        umbra: 0,
    });
});
