import {
    biomeAtTile,
    biomesAtTile,
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

    // Test biomesAtTile
    expect(biomesAtTile("w61z4m6h", worldSeed)).to.deep.equal({
        w61z4m3gz: "forest",
        w61z4m65b: "forest",
        w61z4m65c: "forest",
        w61z4m65f: "forest",
        w61z4m65g: "forest",
        w61z4m65u: "forest",
        w61z4m65v: "forest",
        w61z4m65y: "water",
        w61z4m65z: "water",
        w61z4m3up: "water",
        w61z4m6h0: "forest",
        w61z4m6h1: "forest",
        w61z4m6h4: "forest",
        w61z4m6h5: "water",
        w61z4m6hh: "forest",
        w61z4m6hj: "water",
        w61z4m6hn: "forest",
        w61z4m6hp: "forest",
        w61z4m3ur: "forest",
        w61z4m6h2: "forest",
        w61z4m6h3: "forest",
        w61z4m6h6: "forest",
        w61z4m6h7: "forest",
        w61z4m6hk: "forest",
        w61z4m6hm: "water",
        w61z4m6hq: "forest",
        w61z4m6hr: "forest",
        w61z4m3ux: "water",
        w61z4m6h8: "forest",
        w61z4m6h9: "forest",
        w61z4m6hd: "water",
        w61z4m6he: "forest",
        w61z4m6hs: "forest",
        w61z4m6ht: "water",
        w61z4m6hw: "forest",
        w61z4m6hx: "forest",
        w61z4m3uz: "forest",
        w61z4m6hb: "forest",
        w61z4m6hc: "forest",
        w61z4m6hf: "forest",
        w61z4m6hg: "forest",
        w61z4m6hu: "forest",
        w61z4m6hv: "forest",
        w61z4m6hy: "forest",
        w61z4m6hz: "forest",
    });
});
