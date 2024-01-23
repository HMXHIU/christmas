import {
    epochDaysFromDate,
    u8ToByteMask,
    daysToByteMask,
    getDateGreaterThanOrEqualByteMask,
    getDateLessThanOrEqualByteMask,
    getDateWithinRangeFilterCombinations,
} from "../app/src/lib/clients/anchor-client/utils";
import { assert, expect } from "chai";
import {
    DATE_HASH_BITS,
    DATE_HASH_SIZE,
    DAYS_SINCE_1_JAN_2024,
    OFFSET_TO_DATE_HASH_OVERFLOW,
    OFFSET_TO_VALID_FROM_HASH,
    OFFSET_TO_VALID_TO_HASH,
} from "../app/src/lib/clients/anchor-client/defs";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

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

    describe("getDateGreaterThanOrEqualByteMask", () => {
        it("should return the correct mask to compare date >= validFrom", () => {
            // Simulated 'today' dates
            const jan_1 = DAYS_SINCE_1_JAN_2024 * 24 * 60 * 60 * 1000;
            const jan_2 = (DAYS_SINCE_1_JAN_2024 + 1) * 24 * 60 * 60 * 1000;
            const jan_9 = (DAYS_SINCE_1_JAN_2024 + 8) * 24 * 60 * 60 * 1000;
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

            // Everything should be greater thus no mask
            expect(getDateGreaterThanOrEqualByteMask(jan_1)).to.be.null;
            expect(getDateGreaterThanOrEqualByteMask(nextEpochDay_1)).to.be
                .null;

            // Not a full byte mask
            expect(getDateGreaterThanOrEqualByteMask(jan_2)).to.be.null;
            expect(getDateGreaterThanOrEqualByteMask(nextEpochDay_2)).to.be
                .null;

            // First full byte mask
            expect(getDateGreaterThanOrEqualByteMask(jan_9)).to.eql([
                0,
                new Uint8Array([0xff]),
            ]);

            // full byte mask
            expect(getDateGreaterThanOrEqualByteMask(lastEpochDay)).to.eql([
                0,
                new Uint8Array(DATE_HASH_SIZE).fill(0xff),
            ]);
        });
    });

    describe("getDateLessThanOrEqualByteMask", () => {
        it("should return the correct mask to compare date <= validTo", () => {
            // Simulated 'today' dates
            const jan_1 = DAYS_SINCE_1_JAN_2024 * 24 * 60 * 60 * 1000;
            const jan_2 = (DAYS_SINCE_1_JAN_2024 + 1) * 24 * 60 * 60 * 1000;
            const jan_9 = (DAYS_SINCE_1_JAN_2024 + 8) * 24 * 60 * 60 * 1000;
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

            // Full 0's
            expect(getDateLessThanOrEqualByteMask(jan_1)).to.eql([
                0,
                new Uint8Array(DATE_HASH_SIZE).fill(0),
            ]);
            expect(getDateLessThanOrEqualByteMask(nextEpochDay_1)).to.eql([
                0,
                new Uint8Array(DATE_HASH_SIZE).fill(0),
            ]);

            // Not a full byte mask - still return 8 days beyond
            expect(getDateLessThanOrEqualByteMask(jan_2)).to.eql([
                1,
                new Uint8Array(DATE_HASH_SIZE - 1).fill(0),
            ]);
            expect(getDateLessThanOrEqualByteMask(nextEpochDay_2)).to.eql([
                1,
                new Uint8Array(DATE_HASH_SIZE - 1).fill(0),
            ]);

            // First full byte mask
            expect(getDateLessThanOrEqualByteMask(jan_9)).to.eql([
                1,
                new Uint8Array(DATE_HASH_SIZE - 1).fill(0),
            ]);

            // Everything should be less thus no mask
            expect(getDateLessThanOrEqualByteMask(lastEpochDay)).to.be.null;
        });
    });

    describe("getDateWithinRangeFilterCombinations", () => {
        it("should return the correct filter combinations", () => {
            const jan_1 = new Date(DAYS_SINCE_1_JAN_2024 * 24 * 60 * 60 * 1000);

            const jan_9 = new Date(
                (DAYS_SINCE_1_JAN_2024 + 8) * 24 * 60 * 60 * 1000
            );
            const lastEpochDay = new Date(
                (DAYS_SINCE_1_JAN_2024 + DATE_HASH_BITS) * 24 * 60 * 60 * 1000
            );

            /*
             *
             * 1 Jan 2024 is 0...0
             *
             * - Any validTo is always greater -> null
             * - Any validFrom must be 0...0 or from the previous epoch 111111...0
             * - In the normal case if validFrom - validTo is in the previous epoch, 0...0 is already out -> False
             * - In the overflow case, validTo is sure to have crossed the boundary of 0...0 -> True
             *
             */
            expect(getDateWithinRangeFilterCombinations(jan_1)).to.eql([
                [
                    {
                        memcmp: {
                            offset: OFFSET_TO_VALID_FROM_HASH, // 0 offset
                            bytes: bs58.encode(
                                new Uint8Array(DATE_HASH_SIZE).fill(0)
                            ),
                        },
                    },
                ],
                [
                    {
                        memcmp: {
                            offset: OFFSET_TO_DATE_HASH_OVERFLOW,
                            bytes: bs58.encode(Uint8Array.from([1])), // overflow
                        },
                    },
                ],
                [
                    {
                        memcmp: {
                            offset: OFFSET_TO_DATE_HASH_OVERFLOW,
                            bytes: bs58.encode(Uint8Array.from([1])), // overflow
                        },
                    },
                    {
                        memcmp: {
                            offset: OFFSET_TO_VALID_FROM_HASH,
                            bytes: bs58.encode(
                                new Uint8Array(DATE_HASH_SIZE).fill(0)
                            ),
                        },
                    },
                ],
            ]);

            /*
             *
             * 9 Jan 2024 is 0xff...0
             *
             */
            expect(getDateWithinRangeFilterCombinations(jan_9)).to.eql([
                [
                    {
                        memcmp: {
                            offset: OFFSET_TO_VALID_FROM_HASH + 1,
                            bytes: bs58.encode(
                                new Uint8Array(DATE_HASH_SIZE - 1).fill(0)
                            ),
                        },
                    },
                    {
                        memcmp: {
                            offset: OFFSET_TO_VALID_TO_HASH,
                            bytes: bs58.encode(Uint8Array.from([0xff])),
                        },
                    },
                ],
                [
                    {
                        memcmp: {
                            offset: OFFSET_TO_DATE_HASH_OVERFLOW,
                            bytes: bs58.encode(Uint8Array.from([1])), // overflow
                        },
                    },
                    {
                        memcmp: {
                            offset: OFFSET_TO_VALID_TO_HASH,
                            bytes: bs58.encode(Uint8Array.from([0xff])),
                        },
                    },
                ],
                [
                    {
                        memcmp: {
                            offset: OFFSET_TO_DATE_HASH_OVERFLOW,
                            bytes: bs58.encode(Uint8Array.from([1])), // overflow
                        },
                    },
                    {
                        memcmp: {
                            offset: OFFSET_TO_VALID_FROM_HASH + 1,
                            bytes: bs58.encode(
                                new Uint8Array(DATE_HASH_SIZE - 1).fill(0)
                            ),
                        },
                    },
                ],
            ]);

            /*
             *
             * lastEpochDay is 0xff...0xff
             *
             */
            expect(getDateWithinRangeFilterCombinations(lastEpochDay)).to.eql([
                [
                    {
                        memcmp: {
                            offset: OFFSET_TO_VALID_TO_HASH,
                            bytes: bs58.encode(
                                new Uint8Array(DATE_HASH_SIZE).fill(0xff)
                            ),
                        },
                    },
                ],
                [
                    {
                        memcmp: {
                            offset: OFFSET_TO_DATE_HASH_OVERFLOW,
                            bytes: bs58.encode(Uint8Array.from([1])), // overflow
                        },
                    },
                    {
                        memcmp: {
                            offset: OFFSET_TO_VALID_TO_HASH,
                            bytes: bs58.encode(
                                new Uint8Array(DATE_HASH_SIZE).fill(0xff)
                            ),
                        },
                    },
                ],
                [
                    {
                        memcmp: {
                            offset: OFFSET_TO_DATE_HASH_OVERFLOW,
                            bytes: bs58.encode(Uint8Array.from([1])), // overflow
                        },
                    },
                ],
            ]);
        });
    });
});
