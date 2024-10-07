import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
import { biomeAtGeohash, biomes } from "$lib/crossover/world/biomes";
import {
    generateDungeonGraph,
    getAllDungeons,
} from "$lib/crossover/world/dungeons";
import { dungeons } from "$lib/crossover/world/settings/dungeons";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { dungeonEntrancesQuerySet } from "$lib/server/crossover/redis/queries";
import type { ItemEntity } from "$lib/server/crossover/types";
import { flatten } from "lodash-es";
import { beforeAll, describe, expect, test } from "vitest";

beforeAll(async () => {});

describe("Dungeons Tests", () => {
    test("Test `getAllDungeons`", async () => {
        const dungeons = await getAllDungeons("d1");
        expect(Object.keys(dungeons).length).toBe(32 * 32);
    });

    test("Test manual dungeons", async () => {
        const territory = "w2";
        const locationType = "d1";

        // Get dungeon
        const dungeon = dungeons.find((d) => d.dungeon.startsWith(territory));
        expect(dungeon?.dungeon.startsWith(territory)).toBe(true);
        const dg = await generateDungeonGraph(territory, locationType, {
            dungeon,
        });

        // Check all manually defined rooms are present
        for (const { room, entrances } of dungeon!.rooms) {
            expect(dg.rooms.some((r) => r.geohash === room)).toBe(true);
        }

        // Check entrances
        const definedEntrances = flatten(
            dungeon?.rooms.map((r) => r.entrances),
        );
        const generatedEntrances = flatten(dg.rooms.map((r) => r.entrances));
        expect(
            definedEntrances.every((e) => generatedEntrances.includes(e)),
        ).toBe(true);
    });

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

        // Check biome at corridor is traversable
        geohash = autoCorrectGeohashPrecision(
            dg.corridors.values().next().value!,
            worldSeed.spatial.unit.precision,
        );
        var [biome, strength] = await biomeAtGeohash(geohash, locationType);
        expect(biomes[biome].traversableSpeed).greaterThan(0);

        // Check entrances
        const entrances = flatten(dg.rooms.map((r) => r.entrances));
        expect(entrances.length).greaterThan(1);
    });

    test("Test `dungeonEntrancesQuerySet`", async () => {
        // Make sure to initialize world before running this test

        const dungeon = dungeons[0];
        const territory = dungeon.dungeon.slice(
            0,
            worldSeed.spatial.territory.precision,
        );
        const locationType = "geohash";
        const definedEntraceLocations = flatten(
            dungeon.rooms.map((r) => r.entrances),
        );

        const entrances = (await dungeonEntrancesQuerySet(
            territory,
            locationType,
        ).all()) as ItemEntity[];
        expect(entrances.length).greaterThan(1);

        // Test all entrances defined are present
        const entranceLocations = flatten(entrances.map((e) => e.loc));
        expect(
            definedEntraceLocations.every((e) => entranceLocations.includes(e)),
        ).toBe(true);
    });
});
