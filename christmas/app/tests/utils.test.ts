import { substituteVariables } from "$lib/utils";
import { expect, test } from "vitest";

test("Test Utils", async () => {
    expect(substituteVariables("Hello, ${name}", { name: "world" })).toBe(
        "Hello, world",
    );
});
