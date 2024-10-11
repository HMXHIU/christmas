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
import type { BluePrints } from "$lib/crossover/world/blueprint/types";
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
import { groupBy, uniqBy } from "lodash-es";
import { describe, expect, test } from "vitest";

describe("Blueprint Tests", async () => {
    test("Test Instantiate Dungeon Blueprints", async () => {
        const spawnedEntities = await instantiateBlueprintsInDungeons(
            "d1",
            LOCATION_INSTANCE,
            ["w2"],
        );

        // Check items spawned
        expect(spawnedEntities).toMatchObject([
            {
                prop: "dungeonentrance",
                loc: ["w21z6p8m", "w21z6p8t", "w21z6p8k", "w21z6p8s"],
                locT: "geohash", // check at geohash
                locI: "@",
            },
            {
                prop: "dungeonentrance",
                loc: ["w21z6p8t", "w21z6p8v", "w21z6p8s", "w21z6p8u"],
                locT: "d1", // check at d1
                locI: "@",
            },
            {
                prop: "woodendoor",
                loc: ["w21zd057"],
                locT: "d1",
                locI: "@",
                state: "default",
                vars: {},
            },
            {
                player: "innkeeper/15967ded7db164e37a7783609c4a700e",
                name: "Inn Keeper",
                lgn: true,
                rgn: "@@@",
                loc: ["w21vumpp"],
                locT: "d1",
                locI: "@",
                npc: "innkeeper/15967ded7db164e37a7783609c4a700e",
            },
            {
                player: "blacksmith/08075e6875846ad8e34d663e38e13e1c",
                name: "Blacksmith",
                lgn: true,
                rgn: "@@@",
                loc: ["w21vuqpr"],
                locT: "d1",
                locI: "@",
                npc: "blacksmith/08075e6875846ad8e34d663e38e13e1c",
            },
            {
                player: "grocer/5facae6f52682a0393f82a2f78d78275",
                name: "Grocer",
                lgn: true,
                rgn: "@@@",
                loc: ["w21vuqpp"],
                locT: "d1",
                locI: "@",
                npc: "grocer/5facae6f52682a0393f82a2f78d78275",
            },
            {
                player: "alchemist/09b02b48219b465e96f480775dbf6321",
                name: "Alchemist",
                lgn: true,
                rgn: "@@@",
                loc: ["w21vuusv"],
                locT: "d1",
                locI: "@",
                npc: "alchemist/09b02b48219b465e96f480775dbf6321",
            },
        ]);

        // check entrances configured correctly
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
        expect(dungeonBlueprint).toMatchObject({
            location: "w21z9",
            locationType: "d1",
            stencil: {
                w21z6p8m: {
                    blueprint: "entrance",
                    prop: "dungeonentrance",
                    ref: "entrance",
                    variables: {
                        target: "${exit.item}",
                    },
                    overwrite: {
                        locT: "geohash",
                    },
                    unique: true,
                },
                w21z6p8t: {
                    blueprint: "entrance",
                    prop: "dungeonentrance",
                    ref: "exit",
                    variables: {
                        target: "${entrance.item}",
                    },
                    unique: true,
                },
                w21zd057: {
                    blueprint: "control",
                    prop: "woodendoor",
                    unique: true,
                },
                w21vumpp: {
                    blueprint: "market",
                    npc: "innkeeper",
                    unique: true,
                },
                w21vuqpr: {
                    blueprint: "market",
                    npc: "blacksmith",
                    unique: true,
                },
                w21vuqpp: {
                    blueprint: "market",
                    npc: "grocer",
                    unique: true,
                },
                w21vuusv: {
                    blueprint: "market",
                    npc: "alchemist",
                    unique: true,
                },
            },
        });
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
        const territoryBlueprints = await blueprintsAtTerritory(
            "sk",
            "geohash",
            blueprints,
            ["outpost", "town"],
            {
                topologyBufferCache,
                topologyResultCache,
            },
        );

        // Test no overlapping plots for each blueprint
        const propsByBlueprint = groupBy(
            Object.entries(territoryBlueprints.stencil),
            ([loc, b]) => b.blueprint,
        );
        for (const [b, ps] of Object.entries(propsByBlueprint)) {
            const propLocs = ps.map(([loc, { prop, blueprint }]) => loc);
            const uniquePlots = uniqBy(propLocs, (l) =>
                l.slice(0, blueprints[b as BluePrints].precision),
            );
            expect(propLocs.length).toBe(uniquePlots.length);
        }

        // If this change means our world will change!
        expect(hashObject(territoryBlueprints)).toBe(
            "6994c15a7d718821924e55d37ded77398cddb4815a2e025737c61d7f4734f2e2",
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
