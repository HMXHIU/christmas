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
import {
    blueprints,
    dungeonBlueprints,
    dungeonBlueprintsToSpawn,
} from "$lib/crossover/world/settings/blueprint";
import { groupBy, uniqBy } from "lodash-es";
import { beforeAll, describe, expect, test } from "vitest";

beforeAll(async () => {});

describe("Blueprint Tests", () => {
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
                    prop: "dungeonentrance",
                    blueprint: "entrance",
                },
                w21zd057: {
                    prop: "woodendoor",
                    blueprint: "control",
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
        expect(samples).toMatchObject([
            "ske7",
            "skee",
            "skek",
            "sked",
            "skes",
            "sket",
            "skem",
            "ske6",
        ]);

        var samples = sampleChildrenGeohashesAtPrecision(
            "ske",
            4,
            "peripheral",
            24,
            10,
        );
        expect(samples).toMatchObject([
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
        ]);
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
            skbpbq37: {
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

        expect(territoryBlueprints).toMatchObject({
            territory: "sk",
            props: {
                skbk8tkk: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                skc1bv21: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                skgqp2me: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                skvvxskc: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                skyz4q1r: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                skd4twfs: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                sktq4yeu: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                skw3bug9: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                skx459v7: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                sk21dbfg: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                sk34smzb: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                sk7hhgvr: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                skkxxe43: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                skn0sxeg: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                skbs3tkk: {
                    prop: "tavern",
                    blueprint: "town",
                },
                skck8v21: {
                    prop: "tavern",
                    blueprint: "town",
                },
                skgxw2me: {
                    prop: "tavern",
                    blueprint: "town",
                },
                skvntskc: {
                    prop: "tavern",
                    blueprint: "town",
                },
                sky4hq1r: {
                    prop: "tavern",
                    blueprint: "town",
                },
                skd1cwfs: {
                    prop: "tavern",
                    blueprint: "town",
                },
                sktgdyeu: {
                    prop: "tavern",
                    blueprint: "town",
                },
                skwvxug9: {
                    prop: "tavern",
                    blueprint: "town",
                },
                skx3c9v7: {
                    prop: "tavern",
                    blueprint: "town",
                },
                sk272bfg: {
                    prop: "tavern",
                    blueprint: "town",
                },
                sk31emzb: {
                    prop: "tavern",
                    blueprint: "town",
                },
                sk766gvr: {
                    prop: "tavern",
                    blueprint: "town",
                },
                skkkve43: {
                    prop: "tavern",
                    blueprint: "town",
                },
                skn91xeg: {
                    prop: "tavern",
                    blueprint: "town",
                },
            },
        });
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
            territory: "w2",
            locationType: "geohash",
            props: {
                w28d9kjb: {
                    prop: "tavern",
                    blueprint: "outpost",
                },
                w286tkjb: {
                    prop: "tavern",
                    blueprint: "town",
                },
            },
        });
    });
});
