import { compendium } from "$lib/crossover/world/compendium";
import { spawnItem } from "$lib/server/crossover";
import { expect, test } from "vitest";

test("Test Items", async () => {
    const geohash = "w21z3we7";

    const woodenDoor = await spawnItem({
        geohash,
        prop: compendium.woodenDoor.prop,
    });

    expect(woodenDoor).toMatchObject({
        name: "Wooden Door",
        prop: "woodenDoor",
        geohash: geohash,
        durability: 100,
        charges: 0,
    });
});
