import { LRUMemoryCache, MemoryCache } from "$lib/caches";
import { isGeohashTraversableClient } from "$lib/crossover/game";
import {
    biomeAtGeohash,
    elevationAtGeohash,
    topologyAtGeohash,
    topologyTile,
} from "$lib/crossover/world/biomes";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { worldSeed } from "$lib/crossover/world/settings/world";
import { spawnItem } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import type {
    ItemEntity,
    PlayerEntity,
} from "$lib/server/crossover/redis/entities";
import { isGeohashTraversableServer } from "$lib/server/crossover/utils";
import { omit } from "lodash-es";
import { beforeAll, describe, expect, test } from "vitest";
import { itemRecord } from "../../src/store";
import { createGandalfSarumanSauron, generateRandomGeohash } from "./utils";

let region: string;
let geohash: string;
let playerOne: PlayerEntity;
let playerOneCookies: string;
let playerOneStream: EventTarget;
let woodenDoor: ItemEntity;
let woodenDoorGeohash: string;
let playerOneGeohash: string;

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
});

describe("Biome Topology Tests", () => {
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
});
