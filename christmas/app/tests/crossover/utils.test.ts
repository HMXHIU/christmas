import {
    calculateLocation,
    childrenGeohashes,
    expandGeohashes,
    filterSortEntitiesInRange,
    geohashNeighbour,
    geohashToColRow,
    geohashToGridCell,
    getAllUnitGeohashes,
    getPlotsAtGeohash,
    gridCellToGeohash,
} from "$lib/crossover/utils";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { spawnMonster } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import { sampleFrom } from "$lib/utils";
import { KdTree } from "$lib/utils/kdtree";
import { beforeAll, beforeEach, describe, expect, it, test } from "vitest";
import { generateRandomGeohash } from "./utils";

interface TestData {
    id: string;
}
let tree: KdTree<TestData>;

beforeAll(async () => {
    await initializeClients(); // create redis repositories
});

describe("Test KD Tree", async () => {
    beforeEach(() => {
        tree = new KdTree<TestData>(2); // 2D tree for most tests
    });

    it("should insert and find a single point", () => {
        tree.insert([0, 0], { id: "origin" });
        const nearest = tree.findNearest([0, 0]);
        expect(nearest).toEqual({ point: [0, 0], data: { id: "origin" } });
    });

    it("should find the nearest point among multiple points", () => {
        tree.insert([0, 0], { id: "origin" });
        tree.insert([1, 1], { id: "near" });
        tree.insert([10, 10], { id: "far" });
        const nearest = tree.findNearest([0.51, 0.51]);
        expect(nearest).toEqual({ point: [1, 1], data: { id: "near" } });
    });

    it("should return null for an empty tree", () => {
        const nearest = tree.findNearest([0, 0]);
        expect(nearest).toBeNull();
    });

    it("should handle points with the same coordinates", () => {
        tree.insert([1, 1], { id: "first" });
        tree.insert([1, 1], { id: "second" });
        const nearest = tree.findNearest([1, 1]);
        expect(nearest?.point).toEqual([1, 1]);
        // The data could be either 'first' or 'second' depending on insertion order
        expect(["first", "second"]).toContain(nearest?.data.id);
    });

    it("should work with negative coordinates", () => {
        tree.insert([-1, -1], { id: "negative" });
        tree.insert([1, 1], { id: "positive" });
        const nearest = tree.findNearest([-0.5, -0.5]);
        expect(nearest).toEqual({ point: [-1, -1], data: { id: "negative" } });
    });

    it("should handle large numbers", () => {
        tree.insert([1e6, 1e6], { id: "large" });
        tree.insert([0, 0], { id: "origin" });
        const nearest = tree.findNearest([1e6 + 1, 1e6 + 1]);
        expect(nearest).toEqual({ point: [1e6, 1e6], data: { id: "large" } });
    });

    it("should work with more than two dimensions", () => {
        const tree3D = new KdTree<TestData>(3);
        tree3D.insert([1, 1, 1], { id: "3D_point" });
        const nearest = tree3D.findNearest([0.9, 0.9, 0.9]);
        expect(nearest).toEqual({ point: [1, 1, 1], data: { id: "3D_point" } });
    });

    it("should throw an error when inserting a point with wrong dimensions", () => {
        expect(() => tree.insert([0, 0, 0], { id: "wrong" })).toThrow();
    });

    it("should throw an error when searching with a point of wrong dimensions", () => {
        expect(() => tree.findNearest([0, 0, 0])).toThrow();
    });

    it("should handle a large number of points", () => {
        for (let i = 0; i < 1000; i++) {
            tree.insert([Math.random() * 100, Math.random() * 100], {
                id: `point_${i}`,
            });
        }
        const nearest = tree.findNearest([50, 50]);
        expect(nearest).toBeDefined();
        expect(nearest?.point).toHaveLength(2);
        expect(typeof nearest?.data.id).toBe("string");
    });

    it("should find the correct nearest point in a complex scenario", () => {
        tree.insert([2, 3], { id: "A" });
        tree.insert([5, 4], { id: "B" });
        tree.insert([9, 6], { id: "C" });
        tree.insert([4, 7], { id: "D" });
        tree.insert([8, 1], { id: "E" });
        tree.insert([7, 2], { id: "F" });

        const nearest = tree.findNearest([6, 5]);
        expect(nearest).toEqual({ point: [5, 4], data: { id: "B" } });
    });
});

describe("Test Utils", () => {
    test("Test Misc", async () => {
        /*
         * Test `sampleFrom`
         */

        const samples = sampleFrom(
            [{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }],
            2,
            10,
        );
        expect(samples.length).toBe(2);
        expect(samples).toMatchObject([
            {
                i: 2,
            },
            {
                i: 3,
            },
        ]);
        // Test reproducibility
        expect(
            sampleFrom([{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }], 2, 10),
        ).toMatchObject(
            sampleFrom([{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }], 2, 10),
        );
    });

    test("Test Entities", async () => {
        /*
         * Test `filterSortEntitiesInRange`
         */
        var geohash = generateRandomGeohash(8, "h9");
        var east2 = geohashNeighbour(geohash, "e", 2);
        var east3 = geohashNeighbour(east2, "e");
        var southeast2 = geohashNeighbour(east2, "s", 2);

        let dragon = await spawnMonster({
            geohash: geohash,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            beast: "dragon",
        });
        let dragon2 = await spawnMonster({
            geohash: east3,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            beast: "dragon",
        });
        let giantSpider = await spawnMonster({
            geohash: east2,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            beast: "giantSpider",
        });
        let goblin = await spawnMonster({
            geohash: southeast2,
            locationType: "geohash",
            locationInstance: LOCATION_INSTANCE,
            beast: "goblin",
        });
        expect(
            filterSortEntitiesInRange(
                dragon,
                [giantSpider, goblin, dragon2],
                2,
            ),
        ).toMatchObject([
            {
                monster: giantSpider.monster,
            },
            {
                monster: goblin.monster,
            },
        ]);
        expect(
            filterSortEntitiesInRange(
                dragon,
                [giantSpider, goblin, dragon2],
                1,
            ),
        ).toMatchObject([]);
    });

    test("Test Geohash", async () => {
        await initializeClients(); // create redis repositories

        /*
         * Test `geohashToColRow` `geohashToGridCell`
         */
        let [col, row] = geohashToColRow("w2bmekem");
        let { row: row2, col: col2 } = geohashToGridCell("w2bmekem");
        expect(row).equal(row2);
        expect(col).equal(col2);

        [col, row] = geohashToColRow("c5853");
        let { row: row3, col: col3 } = geohashToGridCell("c5853");
        expect(row).equal(row3);
        expect(col).equal(col3);

        [col, row] = geohashToColRow("w61z4m6f");
        expect(col).to.equal(826667);
        expect(row).to.equal(451413);

        expect(geohashToGridCell("w61z4m6f")).to.deep.equal({
            precision: 8,
            row: 451413,
            col: 826667,
            geohash: "w61z4m6f",
        });

        /*
         * Test `gridCellToGeohash`
         */

        var geohash = generateRandomGeohash(8);
        expect(gridCellToGeohash(geohashToGridCell(geohash))).to.equal(geohash);
        var geohash = generateRandomGeohash(7);
        expect(gridCellToGeohash(geohashToGridCell(geohash))).to.equal(geohash);
        var geohash = generateRandomGeohash(6);
        expect(gridCellToGeohash(geohashToGridCell(geohash))).to.equal(geohash);
        expect(gridCellToGeohash(geohashToGridCell("gbsuv7xp"))).to.equal(
            "gbsuv7xp",
        );

        /*
         * Test `calculateLocation`
         */
        let locations = calculateLocation("w21z3wcm", 2, 2);
        expect(locations).toMatchObject([
            "w21z3wcm",
            "w21z3wct",
            "w21z3wck",
            "w21z3wcs",
        ]);

        locations = calculateLocation("w21z3wcm", 1, 1);
        expect(locations).toMatchObject(["w21z3wcm"]);

        locations = calculateLocation("w21z3wcm", 2, 3);
        expect(locations).toMatchObject([
            "w21z3wcm",
            "w21z3wct",
            "w21z3wck",
            "w21z3wcs",
            "w21z3wc7",
            "w21z3wce",
        ]);

        /*
         * Test `expandGeohashes`
         */
        expect(expandGeohashes(["w21z3wcm"], 5)).toEqual([
            "w21z3wcm",
            "w21z3wc",
            "w21z3w",
            "w21z3",
        ]);
        expect(expandGeohashes(["w21z3wcm"], 7)).toEqual([
            "w21z3wcm",
            "w21z3wc",
        ]);
        expect(expandGeohashes(["w21z3wcm"], 8)).toEqual(["w21z3wcm"]);
        expect(expandGeohashes(["w21z3wc"], 8)).toEqual(["w21z3wc"]);

        /*
         * Test `getAllUnitGeohashes`
         */
        expect(getAllUnitGeohashes("w21z3wc").length).toBe(32);
        expect(getAllUnitGeohashes("w21z3w").length).toBe(32 * 32);

        /*
         * Test `geohashNeighbour`
         */
        var geohash = generateRandomGeohash(8);
        expect(geohashNeighbour(geohash, "e", 2)).to.equal(
            geohashNeighbour(geohashNeighbour(geohash, "e"), "e"),
        );

        /*
         * Test `childrenGeohashes`
         */
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

        /*
         * Test `getPlotsAtGeohash`
         */
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
