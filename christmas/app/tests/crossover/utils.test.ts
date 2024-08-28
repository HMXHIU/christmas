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
import { spawnMonster } from "$lib/server/crossover/dungeonMaster";
import { initializeClients } from "$lib/server/crossover/redis";
import { expect, test } from "vitest";
import { generateRandomGeohash } from "./utils";

test("Test Utils", async () => {
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
    expect(expandGeohashes(["w21z3wcm"], 7)).toEqual(["w21z3wcm", "w21z3wc"]);
    expect(expandGeohashes(["w21z3wcm"], 8)).toEqual(["w21z3wcm"]);
    expect(expandGeohashes(["w21z3wc"], 8)).toEqual(["w21z3wc"]);

    /*
     * Test `getAllUnitGeohashes`
     */
    expect(getAllUnitGeohashes("w21z3wc").length).toBe(32);
    expect(getAllUnitGeohashes("w21z3w").length).toBe(32 * 32);

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
        beast: "dragon",
        level: 1,
    });
    let dragon2 = await spawnMonster({
        geohash: east3,
        locationType: "geohash",
        beast: "dragon",
        level: 1,
    });
    let giantSpider = await spawnMonster({
        geohash: east2,
        locationType: "geohash",
        beast: "giantSpider",
        level: 1,
    });
    let goblin = await spawnMonster({
        geohash: southeast2,
        locationType: "geohash",
        beast: "goblin",
        level: 1,
    });
    expect(
        filterSortEntitiesInRange(dragon, [giantSpider, goblin, dragon2], 2),
    ).toMatchObject([
        {
            monster: giantSpider.monster,
        },
        {
            monster: goblin.monster,
        },
    ]);
    expect(
        filterSortEntitiesInRange(dragon, [giantSpider, goblin, dragon2], 1),
    ).toMatchObject([]);

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
