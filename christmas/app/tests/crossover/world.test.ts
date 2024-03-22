import {
    biomeAtGeohash,
    biomesAtGeohash,
    childrenGeohashes,
    geohashToCell,
    updateGrid,
    type WorldSeed,
} from "$lib/crossover/world";
import { expect } from "chai";
import { test } from "vitest";

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
    // Test biomeAtGeohash
    expect(biomeAtGeohash("w21z3m6k", worldSeed)).to.equal("forest");
    expect(biomeAtGeohash("w61z4m6h", worldSeed)).to.equal("water");

    // Test biomesAtGeohash - 7 digits of precision returns tiles with 8 digits of precision
    expect(biomesAtGeohash("w61z4m6", worldSeed)).to.deep.equal({
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

    // Test updateGrid
    let grid = {};
    grid = updateGrid({ grid, biomes: biomesAtGeohash("w61z4m6", worldSeed) });

    expect(grid).to.deep.equal({
        "8": {
            "451408": {
                "826663": {
                    biome: "forest",
                },
                "826664": {
                    biome: "forest",
                },
                "826665": {
                    biome: "forest",
                },
                "826666": {
                    biome: "forest",
                },
                "826667": {
                    biome: "forest",
                },
            },
            "451409": {
                "826663": {
                    biome: "forest",
                },
                "826664": {
                    biome: "water",
                },
                "826665": {
                    biome: "forest",
                },
                "826666": {
                    biome: "forest",
                },
                "826667": {
                    biome: "forest",
                },
            },
            "451410": {
                "826663": {
                    biome: "forest",
                },
                "826664": {
                    biome: "water",
                },
                "826665": {
                    biome: "forest",
                },
                "826666": {
                    biome: "forest",
                },
                "826667": {
                    biome: "water",
                },
            },
            "451411": {
                "826663": {
                    biome: "forest",
                },
                "826664": {
                    biome: "water",
                },
                "826665": {
                    biome: "forest",
                },
                "826666": {
                    biome: "forest",
                },
                "826667": {
                    biome: "forest",
                },
            },
            "451412": {
                "826663": {
                    biome: "forest",
                },
                "826664": {
                    biome: "forest",
                },
                "826665": {
                    biome: "forest",
                },
                "826666": {
                    biome: "water",
                },
                "826667": {
                    biome: "forest",
                },
            },
            "451413": {
                "826663": {
                    biome: "forest",
                },
                "826664": {
                    biome: "forest",
                },
                "826665": {
                    biome: "water",
                },
                "826666": {
                    biome: "forest",
                },
                "826667": {
                    biome: "forest",
                },
            },
            "451414": {
                "826663": {
                    biome: "forest",
                },
                "826664": {
                    biome: "forest",
                },
                "826665": {
                    biome: "forest",
                },
                "826666": {
                    biome: "forest",
                },
                "826667": {
                    biome: "forest",
                },
            },
            "451415": {
                "826663": {
                    biome: "forest",
                },
                "826664": {
                    biome: "forest",
                },
                "826665": {
                    biome: "forest",
                },
                "826666": {
                    biome: "forest",
                },
                "826667": {
                    biome: "forest",
                },
            },
            "451416": {
                "826663": {
                    biome: "forest",
                },
                "826664": {
                    biome: "forest",
                },
                "826665": {
                    biome: "forest",
                },
                "826666": {
                    biome: "forest",
                },
                "826667": {
                    biome: "forest",
                },
            },
        },
    });

    // Test cells in grid
    expect(geohashToCell("w61z4m6f")).to.deep.equal({
        precision: 8,
        row: 451413,
        col: 826667,
    });

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
});
