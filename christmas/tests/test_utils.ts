import {
    dateToBN,
    bnToDate,
    bnToBinaryString,
} from "../lib/anchor-client/utils";
import { assert, expect } from "chai";

describe("Test utils", () => {
    it("Test dateToBN", async () => {
        // Jan 01 2024
        let date = new Date(Date.UTC(2024, 0, 1));
        assert.equal(
            bnToBinaryString(dateToBN(date)), // (y, m, d) Note that month is 0 index based
            "0000000000111100000000000000000000000000000000000000000000000000"
        );
        assert.equal(bnToDate(dateToBN(date)).getTime(), date.getTime());

        // Dec 31 2023
        date = new Date(Date.UTC(2023, 11, 31));
        assert.equal(
            bnToBinaryString(dateToBN(date)), // (y, m, d) Note that month is 0 index based
            "0000000000111000000111111111111111111111111111111111111111110000"
        );
        assert.equal(bnToDate(dateToBN(date)).getTime(), date.getTime());
    });
});
