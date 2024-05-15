import { calculateLocation, expandGeohashes } from "$lib/crossover/utils";
import { expect, test } from "vitest";

test("Test Utils", async () => {
    // Test calculateLocation
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

    // Test expandGeohashes
    expect(expandGeohashes(["w21z3wcm"], 5)).toEqual([
        "w21z3wcm",
        "w21z3wc",
        "w21z3w",
        "w21z3",
    ]);
    expect(expandGeohashes(["w21z3wcm"], 7)).toEqual(["w21z3wcm", "w21z3wc"]);
    expect(expandGeohashes(["w21z3wcm"], 8)).toEqual(["w21z3wcm"]);
    expect(expandGeohashes(["w21z3wc"], 8)).toEqual(["w21z3wc"]);
});
