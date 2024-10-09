import { substituteVariables } from "$lib/utils";
import { expect, test } from "vitest";

test("Test Utils", async () => {
    /**
     * Test `substituteVariables`
     */

    // Test variable substitution
    expect(substituteVariables("Hello, ${name}", { name: "world" })).toBe(
        "Hello, world",
    );

    // Test nested variable substitution
    expect(
        substituteVariables("The ${target.property} value is ${value}", {
            target: { property: "123" },
            value: "456",
        }),
    ).toBe("The 123 value is 456");

    // Test no variables provided
    expect(substituteVariables("Hello, ${name}", {})).toBe("Hello, ${name}");

    // Test variable access using array indexing
    expect(substituteVariables("{{loc[0]}}", { loc: ["w2", "h9"] })).toBe("w2");

    // Test variable access using properties
    expect(substituteVariables("{{point.y}}", { point: { x: 0, y: 1 } })).toBe(
        1,
    );

    /**
     * Test `substituteVariablesRecursively`
     */

    // substituteVariablesRecursively
});
