import { monsterStats } from "$lib/crossover/world/bestiary";
import { expect, test } from "vitest";

test("Test Monster", async () => {
    // Stats
    expect(monsterStats({ level: 1, beast: "goblin" })).toMatchObject({
        hp: 10,
        mp: 10,
        st: 10,
        ap: 10,
    });
    expect(monsterStats({ level: 2, beast: "dragon" })).toMatchObject({
        hp: 20,
        mp: 20,
        st: 20,
        ap: 20,
    });
});
