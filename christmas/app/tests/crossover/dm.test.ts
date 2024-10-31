import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { spawnMonster } from "$lib/server/crossover/dm";
import type { PlayerEntity } from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { describe, expect, test } from "vitest";
import {
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
    dmBuffEntity,
    dmMonsterAbilities,
    dmPerformMonsterAbility,
    dmPerformMonsterAttack,
    dmSpawnMonster,
} from "./utils";

describe("DungeonMaster Tests", async () => {
    let {
        region,
        geohash,
        playerOne,
        playerOneCookies,
        playerTwoStream,
        playerOneStream,
        playerThree,
        playerTwo,
    } = await createGandalfSarumanSauron();

    test("dm.performMonsterAttack", async () => {
        // Spawn goblin to attack player
        const goblin = await spawnMonster({
            geohash,
            locationInstance: LOCATION_INSTANCE,
            locationType: "geohash",
            beast: "goblin",
        });
        await sleep(100);

        // Goblin attacks player
        dmPerformMonsterAttack({
            entity: goblin.monster,
            target: playerOne.player,
        });
        const evs = await collectAllEventDataForDuration(playerOneStream);
        expect(evs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "goblin attacks Gandalf but it fails to connect.",
                    event: "feed",
                },
            ],
            entities: [],
            cta: [],
            action: [
                {
                    action: "miss",
                    source: goblin.monster,
                    target: playerOne.player,
                    event: "action",
                },
            ],
        });
    });

    test("dm.performMonsterAbility", async () => {
        // Spawn goblin to attack player
        const goblin = await spawnMonster({
            geohash,
            locationInstance: LOCATION_INSTANCE,
            locationType: "geohash",
            beast: "goblin",
        });
        await sleep(100);

        // Check goblin abilities
        const abilites = await dmMonsterAbilities(goblin.skills);
        expect(abilites).toEqual(["eyePoke", "bandage"]);

        // Goblin eyePoke player
        dmPerformMonsterAbility({
            ability: "eyePoke",
            target: playerOne.player,
            entity: goblin.monster,
        });
        const evs = await collectAllEventDataForDuration(playerOneStream);
        expect(evs).toMatchObject({
            feed: [
                {
                    type: "message",
                    message: "goblin attacks Gandalf but it fails to connect.",
                    event: "feed",
                },
            ],
            entities: [],
            cta: [],
            action: [
                {
                    ability: "eyePoke",
                    source: goblin.monster,
                    target: playerOne.player,
                    event: "action",
                },
            ],
        });
    });

    test("dm.spawnMonster", async () => {
        // Test unauthorized
        const res = await fetch(
            "http://localhost:5173/trpc/crossover.dm.spawnMonster",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer invalidtoken`,
                },
            },
        );
        expect(res.status).to.equal(401);
        await expect(res.json()).resolves.toMatchObject({
            error: {
                message: "UNAUTHORIZED",
            },
        });

        // Test authorized
        const goblin = await dmSpawnMonster({
            geohash: playerOne.loc[0],
            locationInstance: LOCATION_INSTANCE,
            locationType: "geohash",
            additionalSkills: {
                monster: 5,
                beast: 2,
            },
            beast: "goblin",
        });
        expect(goblin).toMatchObject({
            name: "goblin",
            beast: "goblin",
            loc: playerOne.loc,
            locT: "geohash",
            locI: "@",
            hp: 72,
            mnd: 3,
            cha: 3,
            lum: 0,
            umb: 0,
            skills: {
                monster: 6,
                beast: 3,
                dirtyfighting: 1,
                firstaid: 1,
            },
            buclk: 0,
            cond: [],
            pthclk: 0,
            pthdur: 0,
            pth: [],
            pthst: "",
        });
    });

    test("dm.buffCreature", async () => {
        playerOne = (await dmBuffEntity({
            entity: playerOne.player,
            hp: 100,
            mnd: 100,
            cha: 100,
            lum: 100,
            umb: 100,
        })) as PlayerEntity;

        expect(playerOne).toMatchObject({
            player: playerOne.player,
            hp: 100,
            mnd: 100,
            cha: 100,
            lum: 100,
            umb: 100,
        });
    });
});
