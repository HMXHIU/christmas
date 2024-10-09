import {
    dungeonGraphCache,
    dungeonsAtTerritoryCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "$lib/crossover/caches";
import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
import { biomeAtGeohash, biomes } from "$lib/crossover/world/biomes";
import {
    generateDungeonGraphsForTerritory,
    getAllDungeons,
} from "$lib/crossover/world/dungeons";
import { generateRoomsBSP } from "$lib/crossover/world/dungeons/bsp";
import { prefabDungeons } from "$lib/crossover/world/settings/dungeons";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { dungeonEntrancesQuerySet } from "$lib/server/crossover/redis/queries";
import type { ItemEntity } from "$lib/server/crossover/types";
import { beforeAll, describe, expect, test } from "vitest";

beforeAll(async () => {});

describe("Dungeons Tests", () => {
    test("Test `generateRoomsBSP`", async () => {
        const dungeon = "w21zd";
        const rooms = await generateRoomsBSP({
            geohash: dungeon,
            unitPrecision: 7,
            minDepth: 7,
            maxDepth: 10,
            numRooms: 5,
        });
        expect(rooms.length).toBe(5);
        for (const r of rooms) {
            expect(r.room.startsWith(dungeon));
        }
    });

    test("Test `getAllDungeons`", async () => {
        // This will take a while
        const dungeons = await getAllDungeons("d1", {
            dungeonGraphCache,
            dungeonsAtTerritoryCache,
            topologyBufferCache,
            topologyResponseCache,
            topologyResultCache,
        });
        // Only spawns on land
        const numPrefabDungeons = Object.keys(prefabDungeons).length;
        expect(Object.keys(dungeons).length).toBe(314);

        console.log(JSON.stringify(dungeons["w2"], null, 2));
    });

    test("Test prefab dungeons", async () => {
        for (const [dungeon, _] of Object.entries(prefabDungeons)) {
            const territory = dungeon.slice(0, 2);
            const locationType = "d1";
            let graphs = await generateDungeonGraphsForTerritory(
                territory,
                locationType,
                {
                    dungeonGraphCache,
                    dungeonsAtTerritoryCache,
                    topologyBufferCache,
                    topologyResponseCache,
                    topologyResultCache,
                },
            );
            expect(Object.keys(graphs).length).greaterThan(0);
            expect(
                Object.keys(graphs).find((g) => dungeon.startsWith(g)),
            ).toBeTruthy();
        }
    });

    test("Test `generateDungeonGraph`", async () => {
        const territory = "v7";
        const locationType = "d1";
        const graphs = await generateDungeonGraphsForTerritory(
            territory,
            locationType,
            {
                dungeonGraphCache,
                dungeonsAtTerritoryCache,
                topologyBufferCache,
                topologyResponseCache,
                topologyResultCache,
            },
        );

        for (const [dungeon, dg] of Object.entries(graphs)) {
            // Check graph parameters
            expect(dg.locationType).toBe(locationType);
            expect(dg.dungeon.startsWith(territory)).toBe(true);

            // Check biome at room is traversable
            const room = dg.rooms[0].room;
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
        }
    });

    test("Test `dungeonEntrancesQuerySet` (require initialize world)", async () => {
        const dungeon = Object.keys(prefabDungeons)[0];
        const territory = dungeon.slice(
            0,
            worldSeed.spatial.territory.precision,
        );
        const locationType = "geohash";

        // Run initialize world to create the dungeon entrances
        const entrances = (await dungeonEntrancesQuerySet(
            territory,
            locationType,
        ).all()) as ItemEntity[];
        expect(entrances.length).greaterThan(1);
    });
});
