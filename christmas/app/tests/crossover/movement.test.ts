import { commandMove } from "$lib/crossover";
import { biomeAtGeohash, geohashNeighbour } from "$lib/crossover/world";
import { biomes } from "$lib/crossover/world/biomes";
import { compendium } from "$lib/crossover/world/compendium";
import { spawnItem } from "$lib/server/crossover";
import type { ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer } from "./utils";

test("Test Movement", async () => {
    // Player one
    const playerOneName = "Gandalf";
    let playerOneGeohash = "w21zgssq";
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region: String.fromCharCode(...getRandomRegion()),
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    /*
     * Test obstructive item
     */

    // Spawn tavern below playerOne
    const tavernGeohash = geohashNeighbour(playerOneGeohash, "s"); // below playerOne

    let tavern = (await spawnItem({
        geohash: tavernGeohash,
        prop: compendium.tavern.prop,
    })) as ItemEntity;

    const tavernOrigin = geohashNeighbour(playerOneGeohash, "s");
    expect(tavern).toMatchObject({
        location: [
            tavernOrigin,
            geohashNeighbour(tavernOrigin, "e"),
            geohashNeighbour(tavernOrigin, "s"),
            geohashNeighbour(tavernOrigin, "se"),
        ],
        locationType: "geohash",
    });

    // PlayerOne tries to move south (obstructed by tavern)
    playerOne.location = await commandMove(
        { direction: "s" },
        { Cookie: playerOneCookies },
    );
    expect(playerOne.location[0]).toBe(playerOneGeohash); // PlayerOne should not move

    // PlayerOne move each (unobstructed)
    playerOne.location = await commandMove(
        { direction: "e" },
        { Cookie: playerOneCookies },
    );
    const biome = biomeAtGeohash(geohashNeighbour(playerOneGeohash, "e"));
    expect(biomes[biome].traversable).toBeGreaterThan(0);
    expect(playerOne.location[0]).toBe(geohashNeighbour(playerOneGeohash, "e"));

    // PlayerOne tries to move south (obstructed by tavern)
    let newLocation = await commandMove(
        { direction: "s" },
        { Cookie: playerOneCookies },
    );
    expect(newLocation[0]).toBe(playerOne.location[0]); // PlayerOne should not move
    playerOne.location = newLocation;

    // PlayerOne move south east (unobstructed)
    newLocation = await commandMove(
        { direction: "se" },
        { Cookie: playerOneCookies },
    );
    expect(newLocation[0]).toBe(geohashNeighbour(playerOne.location[0], "se"));
    playerOne.location = newLocation;

    // PlayerOne move west (obstructed by tavern)
    playerOne.location = await commandMove(
        { direction: "w" },
        { Cookie: playerOneCookies },
    );
    expect(playerOne.location[0]).toBe(newLocation[0]); // PlayerOne should not move
});
