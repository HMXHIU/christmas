import { geohashNeighbour } from "$lib/crossover/utils";
import { monsterStats } from "$lib/crossover/world/bestiary";
import { abilities, compendium } from "$lib/crossover/world/settings";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import {
    performMonsterActions,
    selectMonsterAbility,
} from "$lib/server/crossover/dungeonMaster";
import {
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
import { createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test Monster", async () => {
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
        location: [
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
        locationType: "geohash",
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
        location: [playerOneGeohash],
        level: 1,
        hp: 20,
        mp: 20,
        st: 20,
        ap: 11,
        buffs: [],
        debuffs: [],
    });

    // Test cannot spawn monster on collider
    const woodendoorGeohash = generateRandomGeohash(8);
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
    ).rejects.toThrow(
        `Cannot spawn goblin, ${woodendoorGeohash} is untraversable`,
    );

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

    // Test monster attacking player
    goblin.ap = 10;
    goblin.hp = 20;
    goblin = (await monsterRepository.save(
        goblin.monster,
        goblin,
    )) as MonsterEntity;
    playerOne.hp = 20;
    playerOne = (await playerRepository.save(
        playerOne.player,
        playerOne as PlayerEntity,
    )) as PlayerEntity;
    await performMonsterActions([playerOne as PlayerEntity], [goblin]);
    playerOne = (await playerRepository.fetch(
        playerOne.player,
    )) as PlayerEntity;
    goblin = (await monsterRepository.fetch(goblin.monster)) as MonsterEntity;

    expect(playerOne.hp).toBe(20 - 1); // test player hp reduced by scatch damage
    expect(goblin.ap).toBe(10 - abilities.scratch.ap); // test monster ap reduced by scratch ap
});
