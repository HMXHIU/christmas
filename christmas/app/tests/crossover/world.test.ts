import { LRUMemoryCache, MemoryCache } from "$lib/caches";
import { isGeohashTraversableClient } from "$lib/components/crossover/Game/utils";
import { crossoverWorldWorlds } from "$lib/crossover/client";
import {
    childrenGeohashes,
    geohashNeighbour,
    geohashToColRow,
    geohashToGridCell,
    getPlotsAtGeohash,
    gridCellToGeohash,
} from "$lib/crossover/utils";
import {
    biomeAtGeohash,
    elevationAtGeohash,
    topologyAtGeohash,
    topologyTile,
} from "$lib/crossover/world/biomes";
import { TILE_HEIGHT, TILE_WIDTH } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import type { WorldAssetMetadata } from "$lib/crossover/world/types";
import {
    traversableCellsInWorld,
    traversableSpeedInWorld,
} from "$lib/crossover/world/world";
import { spawnItem, spawnWorld } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import type {
    ItemEntity,
    PlayerEntity,
    WorldEntity,
} from "$lib/server/crossover/redis/entities";
import { isGeohashTraversableServer } from "$lib/server/crossover/utils";
import { BUCKETS, ObjectStorage } from "$lib/server/objectStorage";
import { omit } from "lodash-es";
import { beforeAll, describe, expect, test } from "vitest";
import { itemRecord, worldRecord } from "../../src/store";
import { createGandalfSarumanSauron, generateRandomGeohash } from "./utils";

const asset: WorldAssetMetadata = {
    height: 8,
    width: 4,
    tileheight: 128,
    tilewidth: 256,
    layers: [
        {
            data: [
                0, 0, 0, 0, 94, 94, 94, 0, 85, 85, 85, 0, 85, 85, 85, 0, 85, 85,
                85, 0, 95, 139, 95, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
            height: 8,
            name: "platform",
            type: "tilelayer",
            width: 4,
            x: 0,
            y: 0,
        },
        // collider
        {
            data: [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 74, 74, 0, 0, 74, 74, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
            height: 8,
            name: "floor",
            offsetx: 0,
            offsety: -42.6820872917527,
            properties: [
                {
                    name: "traversableSpeed",
                    type: "float",
                    value: 0,
                },
                {
                    name: "interior",
                    type: "bool",
                    value: true,
                },
            ],
            type: "tilelayer",
            width: 4,
            x: 0,
            y: 0,
        },
        {
            data: [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 218, 218, 0, 220, 0, 0, 0, 220, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
            height: 8,
            name: "wall_ne",
            offsetx: 12.010347376201,
            offsety: -37.1388500411984,
            properties: [
                {
                    name: "interior",
                    type: "bool",
                    value: true,
                },
            ],
            type: "tilelayer",
            width: 4,
            x: 0,
            y: 0,
        },
    ],
};
let assetUrl: string;

let region: string;
let geohash: string;
let playerOne: PlayerEntity;
let playerOneCookies: string;
let playerOneStream: EventTarget;
let woodenDoor: ItemEntity;
let woodenDoorGeohash: string;
let playerOneGeohash: string;

let world: WorldEntity;
let worldGeohash: string;
let worldTwo: WorldEntity;
let worldTwoGeohash: string;
let worldThree: WorldEntity;
let worldThreeGeohash: string;
let worldFour: WorldEntity;
let worldFourGeohash: string;

beforeAll(async () => {
    // Create redis repositories
    await initializeClients();

    // Create players
    ({
        region,
        geohash: playerOneGeohash,
        playerOne,
        playerOneCookies,
        playerOneStream,
    } = await createGandalfSarumanSauron());

    // Spawn items
    woodenDoorGeohash = generateRandomGeohash(8, "h9");
    woodenDoor = (await spawnItem({
        geohash: woodenDoorGeohash,
        locationType: "geohash",
        prop: compendium.woodendoor.prop,
        variables: {
            [compendium.woodendoor.variables!.doorsign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    // Set itemRecord
    itemRecord.set({
        [woodenDoor.item]: woodenDoor,
    });

    // Store the test world asset in storage and get the url
    assetUrl = await ObjectStorage.putJSONObject({
        owner: null,
        name: "tilemaps/test_world_asset.json",
        data: asset,
        bucket: BUCKETS.tiled,
    });

    // Spawn worlds
    worldGeohash = "w21z8ucp"; // top left plot
    world = await spawnWorld({
        assetUrl,
        geohash: worldGeohash,
        locationType: "geohash",
        tileHeight: asset.tileheight,
        tileWidth: asset.tilewidth,
    });
    worldTwoGeohash = generateRandomGeohash(8);
    worldTwo = await spawnWorld({
        assetUrl,
        geohash: worldTwoGeohash,
        locationType: "geohash",
        tileHeight: asset.tileheight / 2, // 128 / 2 = 64
        tileWidth: asset.tilewidth / 2, // 256 / 2 = 128
    });
    worldThreeGeohash = "gbsuv7xp";
    worldThree = await spawnWorld({
        assetUrl,
        geohash: worldThreeGeohash,
        locationType: "geohash",
        tileHeight: TILE_HEIGHT,
        tileWidth: TILE_WIDTH,
    });
    worldFourGeohash = "gbsuv7xe"; // origin should be same as worldThree (same plot)
    worldFour = await spawnWorld({
        assetUrl,
        geohash: worldFourGeohash,
        locationType: "geohash",
        tileHeight: TILE_HEIGHT,
        tileWidth: TILE_WIDTH,
    });

    // Set worldRecord
    worldRecord.set({
        [worldGeohash.slice(-2)]: {
            [world.world]: world,
        },
        [worldTwoGeohash.slice(-2)]: {
            [worldTwo.world]: worldTwo,
        },
        [worldThreeGeohash.slice(-2)]: {
            [worldThree.world]: worldThree,
        },
        [worldFourGeohash.slice(-2)]: {
            [worldFour.world]: worldFour,
        },
    });
});

describe("World Tests", () => {
    test("Test traversableCellsInWorld", async () => {
        // Test when cell dimensions == tile dimensions
        let traversableCells = await traversableCellsInWorld({
            world,
            tileHeight: asset.tileheight,
            tileWidth: asset.tilewidth,
        });
        expect(traversableCells).toMatchObject({
            "1,3": 0,
            "1,4": 0,
            "2,3": 0,
            "2,4": 0,
        });

        // Test when tile dimensions is 2x the cell dimensions
        traversableCells = await traversableCellsInWorld({
            world,
            tileHeight: asset.tileheight / 2,
            tileWidth: asset.tilewidth / 2,
        });
        expect(Object.keys(traversableCells).length).to.equal(4 * 4);
        expect(traversableCells).toMatchObject({
            "2,6": 0,
            "3,6": 0,
            "2,7": 0,
            "3,7": 0,
            "4,6": 0,
            "5,6": 0,
            "4,7": 0,
            "5,7": 0,
            "2,8": 0,
            "3,8": 0,
            "2,9": 0,
            "3,9": 0,
            "4,8": 0,
            "5,8": 0,
            "4,9": 0,
            "5,9": 0,
        });
    });

    test("Test traversableSpeedInWorld", async () => {
        // No cells with traversableSpeed
        for (const geohash of ["w21z8ucp", "w21z8ucb"]) {
            await expect(
                traversableSpeedInWorld({
                    tileHeight: asset.tileheight,
                    tileWidth: asset.tilewidth,
                    geohash,
                    world,
                }),
            ).resolves.toEqual(undefined);
        }

        // Cells with traversableSpeed
        for (const geohash of [
            "w21z8uck",
            "w21z8ucs",
            "w21z8uc7",
            "w21z8uce",
        ]) {
            await expect(
                traversableSpeedInWorld({
                    tileHeight: asset.tileheight,
                    tileWidth: asset.tilewidth,
                    geohash,
                    world,
                }),
            ).resolves.toEqual(0);
        }

        // Cells with traversableSpeed - tile dimensions smaller than world
        for (const geohash of [
            "w21z8uc9",
            "w21z8ucc",
            "w21z8uc8",
            "w21z8ucb",
            "w21z8udp",
            "w21z8udr",
            "w21z8udn",
            "w21z8udq",
            "w21z8uf1",
            "w21z8uf3",
            "w21z8uf0",
            "w21z8uf2",
            "w21z8u9x",
            "w21z8u9z",
            "w21z8u9w",
            "w21z8u9y",
        ]) {
            await expect(
                traversableSpeedInWorld({
                    tileHeight: asset.tileheight / 2,
                    tileWidth: asset.tilewidth / 2,
                    geohash,
                    world,
                }),
            ).resolves.toEqual(0);
        }
    });

    test("Test isGeohashTraversable", async () => {
        // Wooden door collider not traversable
        await expect(
            isGeohashTraversableServer(woodenDoorGeohash, "geohash"),
        ).resolves.toBe(false);
        await expect(
            isGeohashTraversableClient(woodenDoorGeohash, "geohash"),
        ).resolves.toBe(false);

        // Ocean not traversable
        await expect(
            isGeohashTraversableServer("2b67676h", "geohash"),
        ).resolves.toBe(false);
        await expect(
            isGeohashTraversableClient("2b67676h", "geohash"),
        ).resolves.toBe(false);

        // World collider not traversable
        await expect(
            isGeohashTraversableServer("w21z8uck", "geohash"),
        ).resolves.toBe(false);
        await expect(
            isGeohashTraversableClient("w21z8uck", "geohash"),
        ).resolves.toBe(false);
    });

    test("Test Worlds", async () => {
        /* Test world colliders/locations
        [
            0, 0, 0, 0,
            0, 0, 0, 0, 
            0, 0, 0, 0, 
            0, x, x, 0, 
            0, x, x, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
        ]
        */
        var origin = childrenGeohashes(worldGeohash.slice(0, -1))[0];
        var p = geohashNeighbour(geohashNeighbour(origin, "s", 3), "e");
        var p2 = geohashNeighbour(p, "s");
        expect(world).toMatchObject({
            loc: [origin.slice(0, -1)],
            locT: "geohash",
        });

        /* Test colliders/locations if cell dimensions is different from tile dimensions
        [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, x, x, x, x, 0, 0,
            0, 0, x, x, x, x, 0, 0,
            0, 0, x, x, x, x, 0, 0,
            0, 0, x, x, x, x, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
        ]
        */
        var origin = childrenGeohashes(worldTwoGeohash.slice(0, -1))[0];
        var p = geohashNeighbour(geohashNeighbour(origin, "s", 6), "e", 2);
        var p2 = geohashNeighbour(p, "s");
        var p3 = geohashNeighbour(p2, "s");
        var p4 = geohashNeighbour(p3, "s");
        var parentGeohash = origin.slice(0, -1);
        expect(worldTwo.loc).to.deep.equal([
            parentGeohash,
            geohashNeighbour(parentGeohash, "e"),
            geohashNeighbour(parentGeohash, "s"),
            geohashNeighbour(geohashNeighbour(parentGeohash, "s"), "e"),
        ]);

        // Test retrieve worlds
        const { town, worlds } = await crossoverWorldWorlds(
            worldTwoGeohash,
            "geohash",
            {
                Cookie: playerOneCookies,
            },
        );
        expect(town.length).to.equal(worldSeed.spatial.town.precision);
        expect(worlds).toMatchObject([{ world: worldTwo.world }]);

        // Test location origins
        expect(worldThree.loc[0]).toBe("gbsuv7x");
        expect(worldFour.loc[0]).toBe("gbsuv7x");
    });

    test("Test Topology", async () => {
        // Test topologyTile
        expect(topologyTile("w2bpbpbp")).toMatchObject({
            topLeft: "w2bpbpbp",
            rows: 32768,
            cols: 32768,
            col: 0,
            row: 0,
        });
        expect(topologyTile("w2pbpbpb")).toMatchObject({
            topLeft: "w2bpbpbp",
            rows: 32768,
            cols: 32768,
            col: 32767,
            row: 32767,
        });

        // Test topologyAtGeohash
        expect(
            omit(await topologyAtGeohash("w2bpbpbp"), ["png"]), // top left
        ).toMatchObject({
            width: 3507,
            height: 1753,
            x: 0,
            y: 0,
        });
        expect(
            omit(await topologyAtGeohash("w2pbpbpb"), ["png"]), // bottom right
        ).toMatchObject({
            width: 3507,
            height: 1753,
            x: 3506,
            y: 1752,
        });

        var chile = omit(await topologyAtGeohash("67z1ekgt"), ["png"]);
        expect(chile).toMatchObject({
            width: 3507,
            height: 1753,
            x: 3113,
            y: 347,
            intensity: 108,
        });

        var everest = omit(await topologyAtGeohash("tvpjj3cd"), ["png"]);
        expect(everest).toMatchObject({
            width: 3507,
            height: 1753,
            x: 3140,
            y: 1475,
            intensity: 183,
        });
        var redsea = omit(await topologyAtGeohash("sgekek77"), ["png"]);
        expect(redsea).toMatchObject({
            width: 3507,
            height: 1753,
            x: 1470,
            y: 622,
            intensity: 0,
        });
        var bukittimahhill = omit(await topologyAtGeohash("w21z9qx9"), ["png"]);
        expect(bukittimahhill).toMatchObject({
            width: 3507,
            height: 1753,
            x: 787,
            y: 1330,
            intensity: 3,
        });

        // Test topologyAtGeohash with caching
        const bufferCache = new MemoryCache(); // caches the png buffer
        const responseCache = new MemoryCache(); // caches the fetch response
        const resultsCache = new LRUMemoryCache({ max: 100 }); // caches the results
        expect(
            omit(await topologyAtGeohash("tvpjj3cd", { bufferCache }), "png"),
        ).toMatchObject(
            omit(await topologyAtGeohash("tvpjj3cd", { bufferCache }), "png"),
        );
        expect(
            omit(await topologyAtGeohash("tvpjj3cd", { bufferCache }), "png"),
        ).toMatchObject(everest);

        // Test heightAtGeohash with LRUCache
        var everestHeight = await elevationAtGeohash("tvpjj3cd", "geohash");
        expect(everestHeight).toBe(6352);
        await expect(
            elevationAtGeohash("tvpjj3cd", "geohash", {
                resultsCache,
                responseCache,
                bufferCache,
            }),
        ).resolves.toBe(everestHeight);
        await expect(
            elevationAtGeohash("tvpjj3cd", "geohash", {
                resultsCache,
                responseCache,
                bufferCache,
            }),
        ).resolves.toBe(
            await elevationAtGeohash("tvpjj3cd", "geohash", {
                resultsCache,
                responseCache,
                bufferCache,
            }),
        );
    });

    test("Test Procedural Generation", async () => {
        // Test biomeAtGeohash
        expect(
            (
                await biomeAtGeohash("w6cn25dm", "geohash", { seed: worldSeed })
            )[0],
        ).to.equal("forest");
        expect(
            (
                await biomeAtGeohash("w2gpdqgt", "geohash", { seed: worldSeed })
            )[0],
        ).to.equal("water");

        // Test geohashToGridCell
        expect(geohashToGridCell("w61z4m6f")).to.deep.equal({
            precision: 8,
            row: 451413,
            col: 826667,
            geohash: "w61z4m6f",
        });

        // Test geohashToColRow
        const [col, row] = geohashToColRow("w61z4m6f");
        expect(col).to.equal(826667);
        expect(row).to.equal(451413);

        // Test gridCellToGeohash
        var geohash = generateRandomGeohash(8);
        expect(gridCellToGeohash(geohashToGridCell(geohash))).to.equal(geohash);
        var geohash = generateRandomGeohash(7);
        expect(gridCellToGeohash(geohashToGridCell(geohash))).to.equal(geohash);
        var geohash = generateRandomGeohash(6);
        expect(gridCellToGeohash(geohashToGridCell(geohash))).to.equal(geohash);
        expect(gridCellToGeohash(geohashToGridCell("gbsuv7xp"))).to.equal(
            "gbsuv7xp",
        );

        // Test geohashNeighbour
        var geohash = generateRandomGeohash(8);
        expect(geohashNeighbour(geohash, "e", 2)).to.equal(
            geohashNeighbour(geohashNeighbour(geohash, "e"), "e"),
        );

        // Test childrenGeohashes
        expect(childrenGeohashes("w61z4m6").sort()).to.deep.equal(
            [
                "w61z4m6p",
                "w61z4m6r",
                "w61z4m6x",
                "w61z4m6z",
                "w61z4m6n",
                "w61z4m6q",
                "w61z4m6w",
                "w61z4m6y",
                "w61z4m6j",
                "w61z4m6m",
                "w61z4m6t",
                "w61z4m6v",
                "w61z4m6h",
                "w61z4m6k",
                "w61z4m6s",
                "w61z4m6u",
                "w61z4m65",
                "w61z4m67",
                "w61z4m6e",
                "w61z4m6g",
                "w61z4m64",
                "w61z4m66",
                "w61z4m6d",
                "w61z4m6f",
                "w61z4m61",
                "w61z4m63",
                "w61z4m69",
                "w61z4m6c",
                "w61z4m60",
                "w61z4m62",
                "w61z4m68",
                "w61z4m6b",
            ].sort(),
        );

        // Test getPlotsAtGeohash
        let loc = generateRandomGeohash(8);
        var parentGeohash = loc.slice(0, -1);
        let plotGeohashes = getPlotsAtGeohash(loc, 8, 4);
        expect(plotGeohashes).to.deep.equal([parentGeohash]);

        plotGeohashes = getPlotsAtGeohash(loc, 16, 8);
        expect(plotGeohashes).to.deep.equal([
            parentGeohash,
            geohashNeighbour(parentGeohash, "e"),
            geohashNeighbour(parentGeohash, "s"),
            geohashNeighbour(geohashNeighbour(parentGeohash, "s"), "e"),
        ]);
    });
});
