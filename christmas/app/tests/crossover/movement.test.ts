import { crossoverCmdMove } from "$lib/crossover";
import { geohashNeighbour } from "$lib/crossover/utils";
import { biomeAtGeohash } from "$lib/crossover/world/biomes";
import { biomes, compendium } from "$lib/crossover/world/settings";
import { spawnItem } from "$lib/server/crossover";
import type { ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test Movement", async () => {
    // Player one
    const playerOneName = "Gandalf";
    let playerOneGeohash = generateRandomGeohash(8, "h9");
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
    await expect(
        crossoverCmdMove({ direction: "s" }, { Cookie: playerOneCookies }),
    ).resolves.toMatchObject({
        status: "failure",
        message: "Cannot move s",
    });
    expect(playerOne.location[0]).toBe(playerOneGeohash); // PlayerOne should not move

    // PlayerOne move each (unobstructed)
    playerOne.location = (
        await crossoverCmdMove({ direction: "e" }, { Cookie: playerOneCookies })
    ).players?.[0].location!;
    const biome = biomeAtGeohash(geohashNeighbour(playerOneGeohash, "e"));
    expect(biomes[biome].traversableSpeed).toBeGreaterThan(0);
    expect(playerOne.location[0]).toBe(geohashNeighbour(playerOneGeohash, "e"));

    // PlayerOne tries to move south (obstructed by tavern)
    await expect(
        crossoverCmdMove({ direction: "s" }, { Cookie: playerOneCookies }),
    ).resolves.toMatchObject({
        status: "failure",
        message: "Cannot move s",
    });

    // PlayerOne move south east (unobstructed)
    var newLocation = (
        await crossoverCmdMove(
            { direction: "se" },
            { Cookie: playerOneCookies },
        )
    ).players?.[0].location!;
    expect(newLocation[0]).toBe(geohashNeighbour(playerOne.location[0], "se"));
    playerOne.location = newLocation;

    // PlayerOne move west (obstructed by tavern)
    await expect(
        crossoverCmdMove({ direction: "w" }, { Cookie: playerOneCookies }),
    ).resolves.toMatchObject({
        status: "failure",
        message: "Cannot move w",
    });
    expect(playerOne.location[0]).toBe(newLocation[0]); // PlayerOne should not move
});
