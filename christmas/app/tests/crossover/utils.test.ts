import { calculateLocation } from "$lib/crossover/utils";
import { expect, test } from "vitest";

test("Test Utils", async () => {
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
});
