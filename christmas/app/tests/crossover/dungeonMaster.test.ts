import { INTERNAL_SERVICE_KEY } from "$env/static/private";
import { borderingGeohashes } from "$lib/crossover/utils";
import { monsterLimitAtGeohash } from "$lib/crossover/world/bestiary";
import { spawnMonsters } from "$lib/server/crossover/dungeonMaster";
import {
    initializeClients,
    monstersInGeohashQuerySet,
} from "$lib/server/crossover/redis";
import type {
    Player,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { beforeAll, describe, expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { buffEntity, createRandomPlayer } from "./utils";

const RESPAWN_ENDPOINT =
    "http://localhost:5173/trpc/crossover.world.respawnMonsters";
const region = String.fromCharCode(...getRandomRegion());
let playerOne: Player, playerTwo: Player, playerThree: Player;
let uninhabitedGeohashes: string[];
let maxMonstersInArea: number;

beforeAll(async () => {
    await initializeClients(); // create redis repositories

    // Create players
    [, , playerOne] = await createRandomPlayer({
        region,
        geohash: "w21z3tss",
        name: "Gandalf",
    });

    [, , playerTwo] = await createRandomPlayer({
        region,
        geohash: "w21z3ttk",
        name: "Saruman",
    });

    [, , playerThree] = await createRandomPlayer({
        region,
        geohash: "w21z3tk8",
        name: "Sauron",
    });

    // Get uninhabited neighboring geohashes
    uninhabitedGeohashes = await borderingGeohashes([
        "w21z3ts",
        "w21z3tt",
        "w21z3tk",
    ]);

    // Calculate max monsters in area
    maxMonstersInArea = uninhabitedGeohashes.reduce(
        (acc, currentGeohash) => monsterLimitAtGeohash(currentGeohash) + acc,
        0,
    );
});

describe("DungeonMaster Tests", () => {
    test("Test `borderingGeohashes`", () => {
        expect(uninhabitedGeohashes.sort()).to.deep.equal(
            [
                "w21z3tg",
                "w21z3tu",
                "w21z3tv",
                "w21z3ty",
                "w21z3te",
                "w21z3tw",
                "w21z3t7",
                "w21z3tm",
                "w21z3tq",
                "w21z3t5",
                "w21z3th",
                "w21z3tj",
            ].sort(),
        );
    });

    test("Spawn monsters cannot exceed monster limit", async () => {
        await spawnMonsters([
            playerOne as PlayerEntity,
            playerTwo as PlayerEntity,
            playerThree as PlayerEntity,
        ]);
        await spawnMonsters([
            playerOne as PlayerEntity,
            playerTwo as PlayerEntity,
            playerThree as PlayerEntity,
        ]);
        await spawnMonsters([
            playerOne as PlayerEntity,
            playerTwo as PlayerEntity,
            playerThree as PlayerEntity,
        ]);

        const numMonstersInArea = await Promise.all(
            uninhabitedGeohashes.map((geohash) =>
                monstersInGeohashQuerySet([geohash], "geohash").count(),
            ),
        ).then((monsterCounts) =>
            monsterCounts.reduce((acc, current) => acc + current, 0),
        );

        expect(numMonstersInArea).to.lessThan(maxMonstersInArea);

        // Monster limit in area
        expect(maxMonstersInArea).to.equal(41);
    });

    test("world.respawnMonsters - authorized", async () => {
        await expect(
            fetch(RESPAWN_ENDPOINT, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${INTERNAL_SERVICE_KEY}`,
                },
            }).then((res) => res.json()),
        ).resolves.toMatchObject({
            result: {
                data: {
                    status: "success",
                    time: expect.any(Number),
                },
            },
        });
    });

    test("world.respawnMonsters - unauthorized", async () => {
        const res = await fetch(RESPAWN_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer invalidtoken`,
            },
        });
        expect(res.status).to.equal(401);
        await expect(res.json()).resolves.toMatchObject({
            error: {
                message: "UNAUTHORIZED",
            },
        });
    });

    test("world.buffEntity", async () => {
        playerOne = (await buffEntity(playerOne.player, {
            hp: 100,
            mp: 100,
            st: 100,
            ap: 40,
            buffs: ["haste"],
            debuffs: ["poisoned"],
        })) as Player;

        expect(playerOne).toMatchObject({
            player: playerOne.player,
            name: "Gandalf",
            lgn: true,
            loc: ["w21z3tss"],
            lvl: 1,
            hp: 100,
            mp: 100,
            st: 100,
            ap: 40,
            dbuf: ["poisoned"],
            buf: ["haste"],
        });
    });
});
