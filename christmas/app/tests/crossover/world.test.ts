import { MemoryCache } from "$lib/caches";
import { crossoverWorldWorlds } from "$lib/crossover";
import {
    childrenGeohashes,
    geohashNeighbour,
    geohashToColRow,
    getPlotsAtGeohash,
} from "$lib/crossover/utils";
import {
    geohashToGridCell,
    gridCellToGeohash,
    type WorldAssetMetadata,
    type WorldSeed,
} from "$lib/crossover/world";
import {
    biomeAtGeohash,
    biomesNearbyGeohash,
    heightAtGeohash,
    topologyAtGeohash,
    topologyTile,
} from "$lib/crossover/world/biomes";
import { TILE_HEIGHT, TILE_WIDTH } from "$lib/crossover/world/settings";
import { spawnWorld } from "$lib/server/crossover";
import { LRUCache } from "lru-cache";
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
    expect((await biomeAtGeohash("w21z3m6k", { seed: worldSeed }))[0]).to.equal(
        "forest",
    );
    expect((await biomeAtGeohash("w61z4m6h", { seed: worldSeed }))[0]).to.equal(
        "water",
    );

    // Test biomesNearbyGeohash - 7 digits of precision returns tiles with 8 digits of precision
    expect(
        await biomesNearbyGeohash("w61z4m6", { seed: worldSeed }),
    ).to.deep.equal({
        w61z4m1z: "forest",
        w61z4m4p: "forest",
        w61z4m4r: "forest",
        w61z4m4x: "forest",
        w61z4m4z: "forest",
        w61z4m3b: "forest",
        w61z4m60: "forest",
        w61z4m62: "forest",
        w61z4m68: "forest",
        w61z4m6b: "forest",
        w61z4m3c: "forest",
        w61z4m61: "forest",
        w61z4m63: "forest",
        w61z4m69: "forest",
        w61z4m6c: "forest",
        w61z4m3f: "forest",
        w61z4m64: "forest",
        w61z4m66: "water",
        w61z4m6d: "forest",
        w61z4m6f: "forest",
        w61z4m3g: "forest",
        w61z4m65: "forest",
        w61z4m67: "forest",
        w61z4m6e: "water",
        w61z4m6g: "forest",
        w61z4m3u: "forest",
        w61z4m6h: "water",
        w61z4m6k: "forest",
        w61z4m6s: "forest",
        w61z4m6u: "forest",
        w61z4m3v: "forest",
        w61z4m6j: "water",
        w61z4m6m: "forest",
        w61z4m6t: "forest",
        w61z4m6v: "water",
        w61z4m3y: "forest",
        w61z4m6n: "water",
        w61z4m6q: "forest",
        w61z4m6w: "forest",
        w61z4m6y: "forest",
        w61z4m3z: "forest",
        w61z4m6p: "forest",
        w61z4m6r: "forest",
        w61z4m6x: "forest",
        w61z4m6z: "forest",
    });

    // Test geohashToGridCell
    expect(geohashToGridCell("w61z4m6f")).to.deep.equal({
        precision: 8,
        row: 451413,
        col: 826667,
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

    // Test topologyAtGeohash with caching
    const topologyTileCache = new MemoryCache();
    expect(
        topologyAtGeohash("tvpjj3cd", topologyTileCache),
    ).resolves.toMatchObject(
        await topologyAtGeohash("tvpjj3cd", topologyTileCache),
    );
    expect(
        topologyAtGeohash("tvpjj3cd", topologyTileCache),
    ).resolves.toMatchObject(everest);

    // Test heightAtGeohash with LRUCache
    const lruCache = new LRUCache<string, any>({ max: 100 });
    var everestHeight = await heightAtGeohash("tvpjj3cd");
    expect(everestHeight).toBe(6352);
    await expect(
        heightAtGeohash("tvpjj3cd", {
            resultsCache: lruCache,
            responseCache: topologyTileCache,
        }),
    ).resolves.toBe(everestHeight);
    await expect(
        heightAtGeohash("tvpjj3cd", {
            resultsCache: lruCache,
            responseCache: topologyTileCache,
        }),
    ).resolves.toBe(
        await heightAtGeohash("tvpjj3cd", {
            resultsCache: lruCache,
            responseCache: topologyTileCache,
        }),
    );
});
