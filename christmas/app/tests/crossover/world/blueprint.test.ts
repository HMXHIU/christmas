import {
    blueprintsAtLocationCache,
    dungeonGraphCache,
    dungeonsAtTerritoryCache,
    topologyBufferCache,
    topologyResponseCache,
    topologyResultCache,
} from "$lib/crossover/caches";
import { autoCorrectGeohashPrecision } from "$lib/crossover/utils";
import { biomeAtGeohash, biomes } from "$lib/crossover/world/biomes";
import {
    blueprintsAtDungeon,
    blueprintsAtTerritory,
} from "$lib/crossover/world/blueprint";
import {
    sampleChildrenGeohashesAtPrecision,
    stencilFromBlueprint,
} from "$lib/crossover/world/blueprint/utils";
import { generateDungeonGraphsForTerritory } from "$lib/crossover/world/dungeons";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import {
    blueprints,
    dungeonBlueprints,
    dungeonBlueprintsToSpawn,
} from "$lib/crossover/world/settings/blueprint";
import { hashObject } from "$lib/server";
import { instantiateBlueprintsInDungeons } from "$lib/server/crossover/blueprint";
import type { ItemEntity } from "$lib/server/crossover/types";
import { itemVariableValue } from "$lib/server/crossover/utils";
import { groupBy, uniq } from "lodash-es";
import { describe, expect, test } from "vitest";

describe("Blueprint Tests", async () => {
    test("Test Instantiate Dungeon Blueprints", async () => {
        const spawnedEntities = await instantiateBlueprintsInDungeons(
            "d1",
            LOCATION_INSTANCE,
            ["w2"],
        );

        // If this changes the game changes procedurally
        expect(hashObject(spawnedEntities)).toBe(
            "6c516a71af259b4e95b806f4b6fcca078fc13f99aaafeb0e1dafb30f0d067551",
        );

        // Check dungeon has control point
        expect(spawnedEntities.find((e) => e.prop === "control")).toBeTruthy();

        // Check entrances configured correctly
        const entrance = spawnedEntities[0];
        const exit = spawnedEntities[1];
        const entranceTarget = (
            (await itemVariableValue(
                entrance as ItemEntity,
                "target",
            )) as ItemEntity
        ).item;
        const exitTarget = (
            (await itemVariableValue(
                exit as ItemEntity,
                "target",
            )) as ItemEntity
        ).item;
        expect(entranceTarget).toBe(exit.item);
        expect(exitTarget).toBe(entrance.item);
    });

    test("Test Dungeon Blueprints", async () => {
        // Get the dungeon
        let dungeonGraphs = await generateDungeonGraphsForTerritory(
            "w2",
            "d1",
            {
                dungeonGraphCache,
                dungeonsAtTerritoryCache,
                topologyBufferCache,
                topologyResponseCache,
                topologyResultCache,
            },
        );
        const dungeonGraph = Object.values(dungeonGraphs)[0];
        expect(dungeonGraph).toBeTruthy();

        // Generate the dungeon blueprint
        const dungeonBlueprint = await blueprintsAtDungeon(
            dungeonGraph.dungeon,
            dungeonGraph.locationType,
            dungeonBlueprints,
            dungeonBlueprintsToSpawn,
            {
                blueprintsAtLocationCache: blueprintsAtLocationCache,
                dungeonGraphCache: dungeonGraphCache,
            },
        );

        // If this changes the game changes procedurally
        expect(hashObject(dungeonBlueprint)).toBe(
            "106a6fcf1517a2726e1f9c9d83bb88b3a1d3b55a83a727b4ac78ce7cff82539e",
        );
    });

    test("Test `sampleChildrenGeohashesAtPrecision`", async () => {
        var samples = sampleChildrenGeohashesAtPrecision(
            "ske",
            4,
            "center",
            8,
            10,
        );

        expect(samples.sort()).toMatchObject(
            [
                "ske7",
                "skee",
                "skek",
                "sked",
                "skes",
                "sket",
                "skem",
                "ske6",
            ].sort(),
        );

        var samples = sampleChildrenGeohashesAtPrecision(
            "ske",
            4,
            "peripheral",
            24,
            10,
        );
        expect(samples.sort()).toMatchObject(
            [
                "ske5",
                "skeg",
                "skec",
                "skev",
                "skez",
                "skeb",
                "ske0",
                "skeh",
                "sken",
                "skef",
                "skej",
                "ske2",
                "skey",
                "skew",
                "skeu",
                "ske8",
                "skep",
                "ske3",
                "ske1",
                "sker",
                "ske4",
                "skeq",
                "skex",
                "ske9",
            ].sort(),
        );
    });

    test("Test `generateProps`", async () => {
        const outpost = blueprints.outpost;
        const plot = autoCorrectGeohashPrecision("sk", outpost.precision);
        const props = await stencilFromBlueprint(
            plot,
            "geohash",
            outpost,
            async (loc, locT) => true,
        );

        expect(props).toMatchObject({
            skbpbpbp: {
                prop: "tavern",
                blueprint: "outpost",
            },
        });

        for (const [loc, prop] of Object.entries(props)) {
            expect(loc.startsWith(plot)).toBe(true);
        }
    });

    test("Test `blueprintsAtTerritory`", async () => {
        const territory = "sk"; // africa, all land
        const territoryBlueprints = await blueprintsAtTerritory(
            territory, // there are 32 regions in 1 territory
            "geohash",
            blueprints,
            ["outpost", "town"],
            {
                topologyBufferCache,
                topologyResultCache,
            },
        );

        const propsByBlueprint = groupBy(
            Object.entries(territoryBlueprints.stencil),
            ([loc, b]) => b.blueprint,
        );
        for (const [b, ps] of Object.entries(propsByBlueprint)) {
            // Check all prop locations are unique
            const propLocations = ps.map(([loc, { prop, blueprint }]) => loc);
            expect(propLocations.length).toBe(uniq(propLocations).length);
        }

        // If this change means our world will change!
        expect(hashObject(territoryBlueprints)).toBe(
            "0bab96846b8c40aab54a9da49fc1c138b9f149027b50040d5b6d9f058c88aa11",
        );
    });

    test("Test `blueprintsAtTerritory` on land", async () => {
        // Test no blueprints in ocean
        var territoryBlueprints = await blueprintsAtTerritory(
            "5w",
            "geohash",
            blueprints,
            ["outpost", "town"],
            {
                topologyBufferCache,
                topologyResultCache,
            },
        );
        expect(Object.values(territoryBlueprints.stencil).length).toBe(0);

        // Test coastal areas
        var territoryBlueprints = await blueprintsAtTerritory(
            "w2",
            "geohash",
            blueprints,
            ["outpost", "town"],
            {
                topologyBufferCache,
                topologyResultCache,
            },
        );
        // Check prop locations on land
        for (const loc of Object.keys(territoryBlueprints.stencil)) {
            const [biome, strength] = await biomeAtGeohash(loc, "geohash", {
                topologyBufferCache,
                topologyResultCache,
            });
            expect(biomes[biome].traversableSpeed > 0);
        }
        expect(territoryBlueprints).toMatchObject({
            location: "w2",
            locationType: "geohash",
            stencil: {
                w2c6epbp: {
                    prop: "tavern",
                    blueprint: "town",
                },
                w29j4093: {
                    prop: "tavern",
                    blueprint: "town",
                },
            },
        });
    });
});
