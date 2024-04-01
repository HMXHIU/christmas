import { abilities } from "$lib/crossover/world/abilities";
import { monsterStats } from "$lib/crossover/world/bestiary";
import { spawnMonster } from "$lib/server/crossover";
import {
    performMonsterActions,
    selectMonsterAbility,
} from "$lib/server/crossover/dungeonMaster";
import {
    monsterRepository,
    playerRepository,
} from "$lib/server/crossover/redis";
import type {
    MonsterEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer } from "./utils";

test("Test Monster", async () => {
    const region = String.fromCharCode(...getRandomRegion());
    const geohash = "w21z3we7";

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = geohash;
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Test monster stats
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

    // Test spawn monster
    let goblin = await spawnMonster({
        geohash: geohash,
        beast: "goblin",
        level: 1,
    });
    expect(goblin).toMatchObject({
        name: "goblin",
        beast: "goblin",
        location: [geohash],
        level: 1,
        hp: 20,
        mp: 20,
        st: 20,
        ap: 11,
        buffs: [],
        debuffs: [],
    });

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
