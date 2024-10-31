import {
    dungeonGraphCache,
    dungeonsAtTerritoryCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "$lib/crossover/caches";
import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
import { biomeAtGeohash, biomes } from "$lib/crossover/world/biomes";
import { generateDungeonGraphsForTerritory } from "$lib/crossover/world/dungeons";
import { generateRoomsBSP } from "$lib/crossover/world/dungeons/bsp";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { prefabDungeons } from "$lib/crossover/world/settings/dungeons";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { factionInControl } from "$lib/server/crossover/actions/capture";
import { spawnLocation } from "$lib/server/crossover/dm";
import {
    controlMonumentsQuerySet,
    dungeonEntrancesQuerySet,
} from "$lib/server/crossover/redis/queries";
import type { ItemEntity } from "$lib/server/crossover/types";
import { describe, expect, test } from "vitest";

describe("Dungeons Tests", async () => {
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

    test("Check dungeons", async () => {
        for (const territory of ["s7", "9x", "6v", "y7", "w2", "qg"]) {
            let graphs = await generateDungeonGraphsForTerritory(
                territory,
                "d1",
                {
                    dungeonGraphCache,
                    dungeonsAtTerritoryCache,
                    topologyBufferCache,
                    topologyResponseCache,
                    topologyResultCache,
                },
            );
            expect(Object.keys(graphs).length).toBeGreaterThan(0);
        }
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

    test("Test dungeon entrances", async () => {
        const dungeon = Object.keys(prefabDungeons)[0];
        const territory = dungeon.slice(
            0,
            worldSeed.spatial.territory.precision,
        );

        // Spawn dungeon at location (this will also spawn the entrance above ground)
        await spawnLocation(dungeon, "d1", LOCATION_INSTANCE);

        // Check dungeon entrances
        const entrancesAboveGround = (await dungeonEntrancesQuerySet(
            territory,
            "geohash",
            LOCATION_INSTANCE,
        ).all()) as ItemEntity[];
        expect(entrancesAboveGround.length).greaterThan(0);
        const entrancesUndeground = (await dungeonEntrancesQuerySet(
            territory,
            "d1",
            LOCATION_INSTANCE,
        ).all()) as ItemEntity[];
        expect(entrancesUndeground.length).greaterThan(0);
    });

    test("Test dungeon monument of control", async () => {
        const dungeon = Object.keys(prefabDungeons)[0];
        const territory = dungeon.slice(
            0,
            worldSeed.spatial.territory.precision,
        );

        // Spawn dungeon
        await spawnLocation(dungeon, "d1", LOCATION_INSTANCE, true);

        // Check monuments have faction
        const monuments = (await controlMonumentsQuerySet(
            territory,
            "d1",
            LOCATION_INSTANCE,
        ).all()) as ItemEntity[];
        expect(monuments.length).greaterThan(0);
        for (const m of monuments) {
            expect(factionInControl(m)).toBeTruthy();
        }
    });
});
