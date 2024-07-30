import { substituteVariables } from "$lib/utils";
import { expect, test } from "vitest";

test("Test Utils", async () => {
    // Test substituteVariables
    expect(substituteVariables("Hello, ${name}", { name: "world" })).toBe(
        "Hello, world",
    );
    expect(
        substituteVariables("The ${target.property} value is ${value}", {
            target: { property: "123" },
            value: "456",
        }),
    ).toBe("The 123 value is 456");
    expect(substituteVariables("Hello, ${name}", {})).toBe("Hello, ${name}");
});
