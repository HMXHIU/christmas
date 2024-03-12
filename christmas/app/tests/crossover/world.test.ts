import {
    biomeAtTile,
    biomesAtTile,
    getCellFromTile,
    updateBiomesGrid,
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
    // Test biomeAtTile
    expect(biomeAtTile("w21z3m6k", worldSeed)).to.equal("forest");
    expect(biomeAtTile("w61z4m6h", worldSeed)).to.equal("water");

    // Test biomesAtTile - 7 digits of precision returns tiles with 8 digits of precision
    expect(biomesAtTile("w61z4m6", worldSeed)).to.deep.equal({
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

    // Test updateBiomesGrid
    let grid = {};
    grid = updateBiomesGrid(grid, biomesAtTile("w61z4m6", worldSeed));
    expect(grid).to.deep.equal({
        "8": {
            "597159": {
                "826663": "forest",
                "826664": "forest",
                "826665": "forest",
                "826666": "forest",
                "826667": "forest",
            },
            "597160": {
                "826663": "forest",
                "826664": "forest",
                "826665": "forest",
                "826666": "forest",
                "826667": "forest",
            },
            "597161": {
                "826663": "forest",
                "826664": "forest",
                "826665": "forest",
                "826666": "forest",
                "826667": "forest",
            },
            "597162": {
                "826663": "forest",
                "826664": "forest",
                "826665": "water",
                "826666": "forest",
                "826667": "forest",
            },
            "597163": {
                "826663": "forest",
                "826664": "forest",
                "826665": "forest",
                "826666": "water",
                "826667": "forest",
            },
            "597164": {
                "826663": "forest",
                "826664": "water",
                "826665": "forest",
                "826666": "forest",
                "826667": "forest",
            },
            "597165": {
                "826663": "forest",
                "826664": "water",
                "826665": "forest",
                "826666": "forest",
                "826667": "water",
            },
            "597166": {
                "826663": "forest",
                "826664": "water",
                "826665": "forest",
                "826666": "forest",
                "826667": "forest",
            },
            "597167": {
                "826663": "forest",
                "826664": "forest",
                "826665": "forest",
                "826666": "forest",
                "826667": "forest",
            },
        },
    });

    // Test cells in grid
    expect(getCellFromTile("w61z4m6f")).to.deep.equal({
        precision: 8,
        row: 597162,
        col: 826667,
    });
});
