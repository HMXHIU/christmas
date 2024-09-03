import { LRUMemoryCache, MemoryCache } from "$lib/caches";
import { isGeohashTraversableClient } from "$lib/components/crossover/Game/utils";
import { crossoverWorldWorlds } from "$lib/crossover/client";
import { childrenGeohashes, geohashNeighbour } from "$lib/crossover/utils";
import {
    biomeAtGeohash,
    elevationAtGeohash,
    topologyAtGeohash,
    topologyTile,
} from "$lib/crossover/world/biomes";
import {
    LOCATION_INSTANCE,
    TILE_HEIGHT,
    TILE_WIDTH,
} from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import type { WorldAssetMetadata } from "$lib/crossover/world/types";
import {
    traversableCellsInWorld,
    traversableSpeedInWorld,
} from "$lib/crossover/world/world";
import { spawnItem, spawnWorld } from "$lib/server/crossover/dungeonMaster";
import {
    initializeClients,
    worldRepository,
    worldsInGeohashQuerySet,
} from "$lib/server/crossover/redis";
import type {
    ItemEntity,
    PlayerEntity,
    WorldEntity,
} from "$lib/server/crossover/redis/entities";
import { isGeohashTraversableServer } from "$lib/server/crossover/utils";
import { sleep } from "$lib/utils";
import { omit } from "lodash-es";
import { beforeAll, describe, expect, test } from "vitest";
import { itemRecord, worldRecord } from "../../src/store";
import {
    createGandalfSarumanSauron,
    createWorldAsset,
    generateRandomGeohash,
} from "./utils";

let assetUrl: string;
let asset: WorldAssetMetadata;

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
        locationInstance: LOCATION_INSTANCE,
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
    const worldAsset = await createWorldAsset();
    asset = worldAsset.asset;
    assetUrl = worldAsset.url;

    // Remove all worlds in test area
    const existingWorlds = await worldsInGeohashQuerySet(
        ["w21z", "gbsu", "y78j"],
        "geohash",
    ).all();
    worldRepository.remove(existingWorlds.map((w) => (w as WorldEntity).world));
    await sleep(1000);

    // Spawn worlds
    worldGeohash = "w21z8ucp"; // top left plot
    world = await spawnWorld({
        assetUrl,
        geohash: worldGeohash,
        locationType: "geohash",
        tileHeight: asset.tileheight,
        tileWidth: asset.tilewidth,
    });
    worldTwoGeohash = "y78jdmsq";
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
    });
});

describe("World Tests", () => {
    test("Test `topologyTile`", async () => {
        // Test at different precisions

        // Check with https://geohash.softeng.co/w21z
        var tile = await topologyTile("w21z");
        expect(tile).toMatchObject({
            cols: 32,
            rows: 32,
            col: 7,
            row: 24,
            topLeft: "w2bp",
        });

        // Check with https://geohash.softeng.co/skbpb
        var tile = await topologyTile("skbk8");
        expect(tile).toMatchObject({
            cols: 256,
            rows: 128,
            col: 8,
            row: 13,
            topLeft: "skbpb",
        });
    });

    test("Test `topologyAtGeohash`", async () => {
        // Test at different precisions
        var topology = await topologyAtGeohash("w21z");
        expect(topology.intensity).greaterThan(0.05);
        var topology = await topologyAtGeohash("w269");
        expect(topology.intensity).toBe(0);
        var topology = await topologyAtGeohash("skbk8");
        expect(topology.intensity).greaterThan(10);
    });

    test("Test `elevationAtGeohash`", async () => {
        // Test at different precisions
        var elevation = await elevationAtGeohash("w21z", "geohash");
        expect(elevation).toBe(2);
        var elevation = await elevationAtGeohash("w269", "geohash");
        expect(elevation).toBe(0);
    });

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
            isGeohashTraversableServer(
                woodenDoorGeohash,
                "geohash",
                LOCATION_INSTANCE,
            ),
        ).resolves.toBe(false);
        await expect(
            isGeohashTraversableClient(
                woodenDoorGeohash,
                "geohash",
                LOCATION_INSTANCE,
            ),
        ).resolves.toBe(false);

        // Ocean not traversable
        await expect(
            isGeohashTraversableServer(
                "2b67676h",
                "geohash",
                LOCATION_INSTANCE,
            ),
        ).resolves.toBe(false);
        await expect(
            isGeohashTraversableClient(
                "2b67676h",
                "geohash",
                LOCATION_INSTANCE,
            ),
        ).resolves.toBe(false);

        // World collider not traversable
        await expect(
            isGeohashTraversableServer(
                "w21z8uck",
                "geohash",
                LOCATION_INSTANCE,
            ),
        ).resolves.toBe(false);
        await expect(
            isGeohashTraversableClient(
                "w21z8uck",
                "geohash",
                LOCATION_INSTANCE,
            ),
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

    test("Test Procedural Generation (biomeAtGeohash)", async () => {
        // Test biomeAtGeohash
        expect(
            (
                await biomeAtGeohash("w6cn25dm", "geohash", { seed: worldSeed })
            )[0],
        ).to.equal("grassland");
        expect(
            (
                await biomeAtGeohash("w2gpdqgt", "geohash", { seed: worldSeed })
            )[0],
        ).to.equal("aquatic");
    });

    test("Test `spawnWorld` (negative)", async () => {
        // Test cant spawn world on existing world
        await expect(
            spawnWorld({
                assetUrl,
                geohash: worldGeohash, // spawn on existing world
                locationType: "geohash",
                tileHeight: asset.tileheight,
                tileWidth: asset.tilewidth,
            }),
        ).rejects.toThrowError(
            `Cannot spawn world on existing worlds ${world.world}`,
        );
    });
});
