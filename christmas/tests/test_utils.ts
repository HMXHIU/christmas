import { filter } from "lodash";
import {
    epochDaysFromDate,
    u8ToByteMask,
    daysToByteMask,
    getDateWithinRangeFilterCombinations,
} from "../lib/anchor-client/utils";
import { assert, expect } from "chai";
import {
    DATE_HASH_BITS,
    DATE_HASH_SIZE,
    DAYS_SINCE_1_JAN_2024,
} from "../lib/anchor-client/defs";

describe("Test utils", () => {
    describe("u8ToByteMask", () => {
        it("should return the correct byte mask", () => {
            assert.equal(u8ToByteMask(0), 0x00);
            assert.equal(u8ToByteMask(1), 0b10000000);
            assert.equal(u8ToByteMask(2), 0b11000000);
            assert.equal(u8ToByteMask(3), 0b11100000);
            assert.equal(u8ToByteMask(4), 0b11110000);
            assert.equal(u8ToByteMask(5), 0b11111000);
            assert.equal(u8ToByteMask(6), 0b11111100);
            assert.equal(u8ToByteMask(7), 0b11111110);
            assert.equal(u8ToByteMask(8), 0b11111111);
        });
    });

    describe("daysToByteMask", () => {
        it("should return the correct byte mask", () => {
            let byteMask: Uint8Array = new Uint8Array(DATE_HASH_SIZE).fill(0);
            byteMask[0] = 0xff;
            expect(daysToByteMask(8)).to.eql(byteMask);

            byteMask[1] = 0xff;
            expect(daysToByteMask(16)).to.eql(byteMask);

            byteMask = new Uint8Array(DATE_HASH_SIZE).fill(0xff);
            expect(daysToByteMask(256)).to.eql(byteMask);

            byteMask = new Uint8Array(DATE_HASH_SIZE).fill(0);
            expect(daysToByteMask(257)).to.eql(byteMask);
        });
    });

    describe("epochDaysFromDate", () => {
        it("should return the correct epoch days", () => {
            const jan_1 = DAYS_SINCE_1_JAN_2024 * 24 * 60 * 60 * 1000;
            const jan_2 = (DAYS_SINCE_1_JAN_2024 + 1) * 24 * 60 * 60 * 1000;
            const lastEpochDay =
                (DAYS_SINCE_1_JAN_2024 + DATE_HASH_BITS) * 24 * 60 * 60 * 1000;
            const nextEpochDay_1 =
                (DAYS_SINCE_1_JAN_2024 + DATE_HASH_BITS + 1) *
                24 *
                60 *
                60 *
                1000;
            const nextEpochDay_2 =
                (DAYS_SINCE_1_JAN_2024 + DATE_HASH_BITS + 2) *
                24 *
                60 *
                60 *
                1000;

            expect(epochDaysFromDate(jan_1)).to.equal(0);
            expect(epochDaysFromDate(jan_2)).to.equal(1);
            expect(epochDaysFromDate(lastEpochDay)).to.equal(DATE_HASH_BITS);
            expect(epochDaysFromDate(nextEpochDay_1)).to.equal(0);

            let byteMask: Uint8Array = new Uint8Array(DATE_HASH_SIZE).fill(0);
            expect(daysToByteMask(epochDaysFromDate(jan_1))).to.deep.equal(
                byteMask
            );
            expect(
                daysToByteMask(epochDaysFromDate(nextEpochDay_1))
            ).to.deep.equal(byteMask);

            byteMask[0] = 0b10000000;
            expect(
                daysToByteMask(epochDaysFromDate(nextEpochDay_2))
            ).to.deep.equal(byteMask);

            byteMask = new Uint8Array(DATE_HASH_SIZE).fill(0xff);
            expect(
                daysToByteMask(epochDaysFromDate(lastEpochDay))
            ).to.deep.equal(byteMask);
        });
    });

    // Add additional test cases as needed for other utility functions
});
