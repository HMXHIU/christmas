import { LRUMemoryCache, MemoryCache } from "$lib/caches";
import { crossoverWorldWorlds } from "$lib/crossover/client";
import {
    childrenGeohashes,
    geohashNeighbour,
    geohashToColRow,
    getPlotsAtGeohash,
} from "$lib/crossover/utils";
import {
    biomeAtGeohash,
    biomesNearbyGeohash,
    elevationAtGeohash,
    topologyAtGeohash,
    topologyTile,
} from "$lib/crossover/world/biomes";
import { TILE_HEIGHT, TILE_WIDTH } from "$lib/crossover/world/settings";
import type { WorldAssetMetadata } from "$lib/crossover/world/types";
import {
    geohashToGridCell,
    gridCellToGeohash,
} from "$lib/crossover/world/utils";
import type { WorldSeed } from "$lib/crossover/world/world";
import { spawnWorld } from "$lib/server/crossover/dungeonMaster";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

const worldSeed: WorldSeed = {
    name: "yggdrasil 01",
    description: "The beginning",
    spatial: {
        continent: {
            precision: 1, // geohash precision
        },
        territory: {
            precision: 2,
        },
        guild: {
            precision: 3,
        },
        city: {
            precision: 4,
        },
        town: {
            precision: 5,
        },
        village: {
            precision: 6,
        },
        house: {
            precision: 7,
        },
        unit: {
            precision: 8,
        },
    },
    constants: {
        maxMonstersPerContinent: 10000000000, // 10 billion
    },
    seeds: {
        continent: {
            b: { bio: 0.5, hostile: 0.2, water: 0.1 },
            c: { bio: 0.5, hostile: 0.2, water: 0.1 },
            f: { bio: 0.5, hostile: 0.2, water: 0.1 },
            g: { bio: 0.5, hostile: 0.2, water: 0.1 },
            u: { bio: 0.5, hostile: 0.2, water: 0.1 },
            v: { bio: 0.5, hostile: 0.2, water: 0.1 },
            y: { bio: 0.5, hostile: 0.2, water: 0.1 },
            z: { bio: 0.5, hostile: 0.2, water: 0.1 },
            "8": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "9": { bio: 0.5, hostile: 0.2, water: 0.1 },
            d: { bio: 0.5, hostile: 0.2, water: 0.1 },
            e: { bio: 0.5, hostile: 0.2, water: 0.1 },
            s: { bio: 0.5, hostile: 0.2, water: 0.1 },
            t: { bio: 0.5, hostile: 0.2, water: 0.1 },
            w: { bio: 0.5, hostile: 0.2, water: 0.1 },
            x: { bio: 0.5, hostile: 0.2, water: 0.1 },
            "2": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "3": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "6": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "7": { bio: 0.5, hostile: 0.2, water: 0.1 },
            k: { bio: 0.5, hostile: 0.2, water: 0.1 },
            m: { bio: 0.5, hostile: 0.2, water: 0.1 },
            q: { bio: 0.5, hostile: 0.2, water: 0.1 },
            r: { bio: 0.5, hostile: 0.2, water: 0.1 },
            "0": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "1": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "4": { bio: 0.5, hostile: 0.2, water: 0.1 },
            "5": { bio: 0.5, hostile: 0.2, water: 0.1 },
            h: { bio: 0.5, hostile: 0.2, water: 0.1 },
            j: { bio: 0.5, hostile: 0.2, water: 0.1 },
            n: { bio: 0.5, hostile: 0.2, water: 0.1 },
            p: { bio: 0.5, hostile: 0.2, water: 0.1 },
        },
    },
};

test("Test World", async () => {
    // Create players
    const region = String.fromCharCode(...getRandomRegion());
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(8);
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: playerOneGeohash,
            name: playerOneName,
        });

    // Test biomeAtGeohash
    expect((await biomeAtGeohash("w6cn25dm", { seed: worldSeed }))[0]).to.equal(
        "forest",
    );
    expect((await biomeAtGeohash("w2gpdqgt", { seed: worldSeed }))[0]).to.equal(
        "water",
    );

    // Test biomesNearbyGeohash - 7 digits of precision returns tiles with 8 digits of precision
    expect(
        await biomesNearbyGeohash("w6u7353", { seed: worldSeed }),
    ).to.deep.equal({
        w6u7350z: "forest",
        w6u7351p: "forest",
        w6u7351r: "forest",
        w6u7351x: "forest",
        w6u7351z: "forest",
        w6u7352b: "forest",
        w6u73530: "forest",
        w6u73532: "forest",
        w6u73538: "forest",
        w6u7353b: "forest",
        w6u7352c: "forest",
        w6u73531: "forest",
        w6u73533: "forest",
        w6u73539: "forest",
        w6u7353c: "water",
        w6u7352f: "water",
        w6u73534: "forest",
        w6u73536: "forest",
        w6u7353d: "forest",
        w6u7353f: "forest",
        w6u7352g: "forest",
        w6u73535: "forest",
        w6u73537: "forest",
        w6u7353e: "forest",
        w6u7353g: "forest",
        w6u7352u: "water",
        w6u7353h: "water",
        w6u7353k: "forest",
        w6u7353s: "forest",
        w6u7353u: "forest",
        w6u7352v: "forest",
        w6u7353j: "forest",
        w6u7353m: "forest",
        w6u7353t: "forest",
        w6u7353v: "forest",
        w6u7352y: "forest",
        w6u7353n: "forest",
        w6u7353q: "water",
        w6u7353w: "forest",
        w6u7353y: "forest",
        w6u7352z: "forest",
        w6u7353p: "forest",
        w6u7353r: "water",
        w6u7353x: "forest",
        w6u7353z: "forest",
    });

    // Test geohashToGridCell
    expect(geohashToGridCell("w61z4m6f")).to.deep.equal({
        precision: 8,
        row: 451413,
        col: 826667,
        geohash: "w61z4m6f",
    });

    // Test geohashToColRow (slightly faster than geohashToGridCell)
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

    /*
    Test spawn world assets (from tiled json format)
    */

    const asset: WorldAssetMetadata = {
        height: 8,
        width: 4,
        tileheight: 128,
        tilewidth: 256,
        layers: [
            {
                data: [
                    0, 0, 0, 0, 94, 94, 94, 0, 85, 85, 85, 0, 85, 85, 85, 0, 85,
                    85, 85, 0, 95, 139, 95, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                ],
                height: 8,
                name: "platform",
                type: "tilelayer",
                width: 4,
                x: 0,
                y: 0,
            },
            {
                data: [
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 74, 74, 0, 0, 74, 74,
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                ],
                height: 8,
                name: "floor",
                offsetx: 0,
                offsety: -42.6820872917527,
                properties: [
                    {
                        name: "collider",
                        type: "bool",
                        value: true,
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
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 218, 218, 0, 220, 0, 0, 0, 220,
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
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

    // Spawn world
    let worldGeohash = generateRandomGeohash(8);
    let world = await spawnWorld({
        asset,
        geohash: worldGeohash,
        tileHeight: asset.tileheight,
        tileWidth: asset.tilewidth,
    });

    /* Test colliders/locations
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
        h: 8,
        w: 4,
        cld: [p, geohashNeighbour(p, "e"), p2, geohashNeighbour(p2, "e")],
    });

    /* Test colliders/locations if cell dimensions is differnt from tile dimensions
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
    worldGeohash = generateRandomGeohash(8);
    world = await spawnWorld({
        asset,
        geohash: worldGeohash,
        tileHeight: asset.tileheight / 2, // 128 / 2 = 64
        tileWidth: asset.tilewidth / 2, // 256 / 2 = 128
    });
    var origin = childrenGeohashes(worldGeohash.slice(0, -1))[0];
    var p = geohashNeighbour(geohashNeighbour(origin, "s", 6), "e", 2);
    var p2 = geohashNeighbour(p, "s");
    var p3 = geohashNeighbour(p2, "s");
    var p4 = geohashNeighbour(p3, "s");
    var parentGeohash = origin.slice(0, -1);
    expect(world.loc).to.deep.equal([
        parentGeohash,
        geohashNeighbour(parentGeohash, "e"),
        geohashNeighbour(parentGeohash, "s"),
        geohashNeighbour(geohashNeighbour(parentGeohash, "s"), "e"),
    ]);
    expect(world.cld.sort()).to.deep.equal(
        [
            // row 1
            p,
            geohashNeighbour(p, "e"),
            geohashNeighbour(p, "e", 2),
            geohashNeighbour(p, "e", 3),
            // row 2
            p2,
            geohashNeighbour(p2, "e"),
            geohashNeighbour(p2, "e", 2),
            geohashNeighbour(p2, "e", 3),
            // row 3
            p3,
            geohashNeighbour(p3, "e"),
            geohashNeighbour(p3, "e", 2),
            geohashNeighbour(p3, "e", 3),
            // row 4
            p4,
            geohashNeighbour(p4, "e"),
            geohashNeighbour(p4, "e", 2),
            geohashNeighbour(p4, "e", 3),
        ].sort(),
    );

    // Test retrieve worlds
    const { town, worlds } = await crossoverWorldWorlds(worldGeohash, {
        Cookie: playerOneCookies,
    });
    expect(town.length).to.equal(worldSeed.spatial.town.precision);
    expect(worlds).toMatchObject([{ world: world.world }]);

    // Test collider and location origins
    worldGeohash = "gbsuv7xp";
    world = await spawnWorld({
        asset,
        geohash: worldGeohash,
        tileHeight: TILE_HEIGHT,
        tileWidth: TILE_WIDTH,
    });
    expect(world.loc[0]).toBe("gbsuv7x");
    expect(world.cld[0]).toBe("gbsuve25");

    worldGeohash = "gbsuv7xe"; // origin should still be at gbsuv7xp as it is in the same
    world = await spawnWorld({
        asset,
        geohash: worldGeohash,
        tileHeight: TILE_HEIGHT,
        tileWidth: TILE_WIDTH,
    });
    expect(world.loc[0]).toBe("gbsuv7x");
    expect(world.cld[0]).toBe("gbsuve25");

    /*
     * Test topology
     */

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
    await expect(topologyAtGeohash("w2bpbpbp")).resolves.toMatchObject({
        width: 3507,
        height: 1753,
        x: 0,
        y: 0,
    });
    await expect(topologyAtGeohash("w2pbpbpb")).resolves.toMatchObject({
        width: 3507,
        height: 1753,
        x: 3506,
        y: 1752,
    });

    var chile = await topologyAtGeohash("67z1ekgt");
    expect(chile).toMatchObject({
        width: 3507,
        height: 1753,
        x: 3114,
        y: 347,
        intensity: 108,
    });

    var everest = await topologyAtGeohash("tvpjj3cd");
    expect(everest).toMatchObject({
        width: 3507,
        height: 1753,
        x: 3140,
        y: 1475,
        intensity: 183,
    });
    var redsea = await topologyAtGeohash("sgekek77");
    expect(redsea).toMatchObject({
        width: 3507,
        height: 1753,
        x: 1470,
        y: 622,
        intensity: 0,
    });
    var bukittimahhill = await topologyAtGeohash("w21z9qx9");
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
        topologyAtGeohash("tvpjj3cd", { bufferCache }),
    ).resolves.toMatchObject(
        await topologyAtGeohash("tvpjj3cd", { bufferCache }),
    );
    expect(
        topologyAtGeohash("tvpjj3cd", { bufferCache }),
    ).resolves.toMatchObject(everest);

    // Test heightAtGeohash with LRUCache
    var everestHeight = await elevationAtGeohash("tvpjj3cd");
    expect(everestHeight).toBe(6352);
    await expect(
        elevationAtGeohash("tvpjj3cd", {
            resultsCache,
            responseCache,
            bufferCache,
        }),
    ).resolves.toBe(everestHeight);
    await expect(
        elevationAtGeohash("tvpjj3cd", {
            resultsCache,
            responseCache,
            bufferCache,
        }),
    ).resolves.toBe(
        await elevationAtGeohash("tvpjj3cd", {
            resultsCache,
            responseCache,
            bufferCache,
        }),
    );
});
