import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
import { biomeAtGeohash, biomes } from "$lib/crossover/world/biomes";
import { generateDungeonGraph } from "$lib/crossover/world/dungeons";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { describe, expect, test } from "vitest";

describe("Dungeons Tests", () => {
    test("Test `generateDungeonGraph`", async () => {
        const territory = "v7";
        const locationType = "d1";
        const dg = await generateDungeonGraph(territory, locationType);

        // Check graph parameters
        expect(dg.locationType).toBe(locationType);
        expect(dg.territory).toBe(territory);

        // Check biome at room is traversable
        const room = dg.rooms[0].geohash;
        var geohash = autoCorrectGeohashPrecision(
            room,
            worldSeed.spatial.unit.precision,
        );
        var [biome, strength] = await biomeAtGeohash(geohash, locationType);
        expect(biomes[biome].traversableSpeed).greaterThan(0);

        // Check biome at corridoor is traversable
        geohash = autoCorrectGeohashPrecision(
            dg.corridors.values().next().value,
            worldSeed.spatial.unit.precision,
        );
        var [biome, strength] = await biomeAtGeohash(geohash, locationType);
        expect(biomes[biome].traversableSpeed).greaterThan(0);

        // Test can traverse from any room to any room
        // const room2 = dg.rooms[1].geohash;
        // const start = autoCorrectGeohashPrecision(
        //     room,
        //     dg.corridorPrecision + 1,
        // );
        // const end = autoCorrectGeohashPrecision(
        //     room2,
        //     dg.corridorPrecision + 1,
        // );

        // const [c1, r1] = geohashToColRow(start);
        // const [c2, r2] = geohashToColRow(end);

        // const directions = await getDirectionsToPosition(
        //     { row: r1, col: c1 },
        //     { row: r2, col: c2 },
        //     locationType,
        //     { precision: dg.corridorPrecision + 1 },
        // );

        // for (const room1 of dg.rooms) {
        //     for (const room2 of dg.rooms) {
        //         if (room1.geohash !== room2.geohash) {
        //             const start = autoCorrectGeohashPrecision(
        //                 room1.geohash,
        //                 dg.corridorPrecision + 1,
        //             );
        //             const end = autoCorrectGeohashPrecision(
        //                 room2.geohash,
        //                 dg.corridorPrecision + 1,
        //             );

        //             const [c1, r1] = geohashToColRow(start);
        //             const [c2, r2] = geohashToColRow(end);

        //             console.log(c1, r1, c2, r2);

        //             const directions = await getDirectionsToPosition(
        //                 { row: r1, col: c1 },
        //                 { row: r2, col: c2 },
        //                 locationType,
        //                 { precision: dg.corridorPrecision + 1 },
        //             );
        //             console.log(directions);
        //         }
        //     }
        // }
    });
});
