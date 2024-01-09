import { filter } from "lodash";
import {
    dateToBytes,
    bytesToDate,
    getDateFilterMask,
    getDateWithinRangeFilterCombinations,
} from "../lib/anchor-client/utils";
import { assert, expect } from "chai";

describe("Test utils", () => {
    /**
     * [DEPRECATED]
     */
    it("Test date to bytes", async () => {
        // Jan 01 2024
        let date = new Date(Date.UTC(2024, 0, 1));
        assert.ok(
            Buffer.from(dateToBytes(date)).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([
                        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // Decade (10 bits)
                        1, 1, 1, 1, 0, 0, 0, 0, 0, // Year (9 bits)
                        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // Month (11 bits)
                        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // Day (30 bits)
                    ])
                )
            )
        );
        assert.equal(bytesToDate(dateToBytes(date)).getTime(), date.getTime());

        // Dec 31 2023
        date = new Date(Date.UTC(2023, 11, 31));
        assert.ok(
            Buffer.from(dateToBytes(date)).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([
                        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                        1, 1, 1, 0, 0, 0, 0, 0, 0,
                        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                    ])
                )
            )
        );
        assert.equal(bytesToDate(dateToBytes(date)).getTime(), date.getTime());
    });

    /**
     * [DEPRECATED]
     */
    it("Test date filter mask (Case 1)", async () => {
        // prettier-ignore
        const today = Uint8Array.from([
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // Decade (10 bits)
            1, 1, 1, 1, 0, 0, 0, 0, 0, // Year (9 bits)
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // Month (11 bits)
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // Day (30 bits)
        ])

        // year equal
        let [offset, bytes] = getDateFilterMask(today, "year", "equal");
        assert.equal(offset, 10);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([1, 1, 1, 1, 0, 0, 0, 0, 0])
                )
            )
        );
        // year lesser
        [offset, bytes] = getDateFilterMask(today, "year", "lesser");
        assert.equal(offset, 13);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([0, 0, 0, 0, 0, 0])
                )
            )
        );
        // year greater
        [offset, bytes] = getDateFilterMask(today, "year", "greater");
        assert.equal(offset, 10);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([1, 1, 1, 1, 1])
                )
            )
        );

        // month equal
        [offset, bytes] = getDateFilterMask(today, "month", "equal");
        assert.equal(offset, 10 + 9);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
                )
            )
        );
        // month lesser
        [offset, bytes] = getDateFilterMask(today, "month", "lesser");
        assert.equal(offset, 10 + 9);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
                )
            )
        );
        // month greater
        [offset, bytes] = getDateFilterMask(today, "month", "greater");
        assert.equal(offset, 10 + 9);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([1])
                )
            )
        );

        // day equal
        [offset, bytes] = getDateFilterMask(today, "day", "equal");
        assert.equal(offset, 10 + 9 + 11);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,])
                )
            )
        );
        // day lesser
        [offset, bytes] = getDateFilterMask(today, "day", "lesser");
        assert.equal(offset, 10 + 9 + 11);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,])
                )
            )
        );
        // day greater
        [offset, bytes] = getDateFilterMask(today, "day", "greater");
        assert.equal(offset, 10 + 9 + 11);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([1])
                )
            )
        );
    });

    /**
     * [DEPRECATED]
     */
    it("Test date filter mask (Case 2)", async () => {
        // prettier-ignore
        const today = Uint8Array.from([
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // Decade (10 bits)
            1, 1, 1, 1, 1, 1, 1, 1, 1, // Year (9 bits)
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // Month (11 bits)
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // Day (30 bits)
        ])

        // year equal
        let [offset, bytes] = getDateFilterMask(today, "year", "equal");
        assert.equal(offset, 10);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1,])
                )
            )
        );
        // year lesser
        [offset, bytes] = getDateFilterMask(today, "year", "lesser");
        assert.equal(offset, 10 + 8);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([0])
                )
            )
        );
        // year greater
        [offset, bytes] = getDateFilterMask(today, "year", "greater");
        assert.equal(offset, 10);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1,])
                )
            )
        );

        // month equal
        [offset, bytes] = getDateFilterMask(today, "month", "equal");
        assert.equal(offset, 10 + 9);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,])
                )
            )
        );
        // month lesser
        [offset, bytes] = getDateFilterMask(today, "month", "lesser");
        assert.equal(offset, 10 + 9 + 10);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([0])
                )
            )
        );
        // month greater
        [offset, bytes] = getDateFilterMask(today, "month", "greater");
        assert.equal(offset, 10 + 9);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,])
                )
            )
        );

        // day equal
        [offset, bytes] = getDateFilterMask(today, "day", "equal");
        assert.equal(offset, 10 + 9 + 11);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,])
                )
            )
        );
        // day lesser
        [offset, bytes] = getDateFilterMask(today, "day", "lesser");
        assert.equal(offset, 10 + 9 + 11 + 29);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([0])
                )
            )
        );
        // day greater
        [offset, bytes] = getDateFilterMask(today, "day", "greater");
        assert.equal(offset, 10 + 9 + 11);
        assert.ok(
            Buffer.from(bytes).equals(
                Buffer.from(
                    // prettier-ignore
                    Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,])
                )
            )
        );
    });
});
