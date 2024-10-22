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
import { factionInControl } from "$lib/server/crossover/actions/capture";
import { spawnDungeonBlueprints } from "$lib/server/crossover/blueprint";
import type { ItemEntity } from "$lib/server/crossover/types";
import { itemVariableValue } from "$lib/server/crossover/utils";
import { groupBy, uniq } from "lodash-es";
import { describe, expect, test } from "vitest";

describe("Blueprint Tests", async () => {
    test("Test Instantiate Dungeon Blueprints", async () => {
        const spawnedEntities = await spawnDungeonBlueprints(
            "w2",
            "d1",
            LOCATION_INSTANCE,
        );

        // If this changes the game changes procedurally
        expect(hashObject(spawnedEntities)).toBe(
            "ccc40807f39e40afed8b15ad4e56687ae3df693169efd01585cc666c459e9694",
        );

        // Check dungeon has monument of control
        const monument = spawnedEntities.find(
            (e) => e.prop === "control",
        ) as ItemEntity;
        expect(monument).toBeTruthy();

        // Check monument of control has no faction (initial faction is set using `spawnLocation`)
        expect(factionInControl(monument)).toBeFalsy();

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
            "7312cbdafeb025e59d5f98bc97c6b4b6849c1a275b29017c8108b812fe656649",
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

        const entitiesByBlueprint = groupBy(
            Object.entries(territoryBlueprints.stencil),
            ([loc, b]) => b.blueprint,
        );
        for (const [b, ps] of Object.entries(entitiesByBlueprint)) {
            // Check all entities locations are unique
            const entityLocations = ps.map(([loc, _]) => loc);
            expect(entityLocations.length).toBe(uniq(entityLocations).length);
        }

        // If this change means our world will change!
        expect(hashObject(territoryBlueprints)).toBe(
            "aabf988ab4baf2be14de3dbc7ac0b6903fec3b0a49a56cfea168ba525f66a06b",
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
