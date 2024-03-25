import { INTERNAL_SERVICE_KEY } from "$env/static/private";
import {
    monsterLimitAtGeohash,
    uninhabitedNeighbouringGeohashes,
} from "$lib/crossover/world";
import { monstersInGeohashQuerySet } from "$lib/server/crossover";
import { spawnMonsters } from "$lib/server/crossover/dungeonMaster";
import type { PlayerEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer } from "./utils";

test("Test DungeonMaster", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = "w21z3tss";
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = "w21z3ttk";
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: playerTwoGeohash,
            name: playerTwoName,
        });

    // Player three
    const playerThreeName = "Sauron";
    const playerThreeGeohash = "w21z3tk8";
    let [playerThreeWallet, playerThreeCookies, playerThree] =
        await createRandomPlayer({
            region,
            geohash: playerThreeGeohash,
            name: playerThreeName,
        });

    // Test get all uninhabited neighbouring geohashes
    const uninhabitedGeohashes = await uninhabitedNeighbouringGeohashes([
        playerOneGeohash.slice(0, -1),
        playerTwoGeohash.slice(0, -1),
        playerThreeGeohash.slice(0, -1),
    ]);
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

    // Test monster limit in area
    const maxMonstersInArea = uninhabitedGeohashes.reduce(
        (acc, currentGeohash) => {
            return monsterLimitAtGeohash(currentGeohash) + acc;
        },
        0,
    );
    expect(maxMonstersInArea).to.equal(41);

    // Test spawn monsters cannot exceed monster limit
    await spawnMonsters([playerOne, playerTwo, playerThree] as PlayerEntity[]);
    await spawnMonsters([playerOne, playerTwo, playerThree] as PlayerEntity[]);
    await spawnMonsters([playerOne, playerTwo, playerThree] as PlayerEntity[]);

    const numMonstersInArea = await Promise.all(
        uninhabitedGeohashes.map((geohash) =>
            monstersInGeohashQuerySet(geohash).count(),
        ),
    ).then((monsterCounts) => {
        return monsterCounts.reduce((acc, current) => acc + current, 0);
    });
    expect(numMonstersInArea).to.equal(maxMonstersInArea);

    // Test world.respawnMonsters
    await expect(
        fetch("http://localhost:5173/trpc/crossover.world.respawnMonsters", {
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

    // Test world.respawnMonsters unauthorized
    const res = await fetch(
        "http://localhost:5173/trpc/crossover.world.respawnMonsters",
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
});
