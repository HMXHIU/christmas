import { dateToBytes, bufferToBinaryString } from "../lib/anchor-client/utils";
import { assert, expect } from "chai";

describe("Test utils", () => {
    it("Test dateToBytes", async () => {
        // Jan 01 2024
        assert.equal(
            bufferToBinaryString(dateToBytes(new Date(Date.UTC(2024, 0, 1)))), // (y, m, d) Note that month is 0 index based
            "1111000000000000000000000000000000000000000000000000000000000000"
        );

        // Dec 31 2023
        assert.equal(
            bufferToBinaryString(dateToBytes(new Date(Date.UTC(2023, 11, 31)))), // (y, m, d) Note that month is 0 index based
            "1110000000111111111110111111111111111111111111111111000000000000"
        );
    });
});
