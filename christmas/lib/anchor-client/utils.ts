import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

import { OFFSET_TO_VALID_FROM, OFFSET_TO_VALID_TO } from "./defs";
import { MemCmp } from "./types";

export function stringToBase58(str: string) {
    const buffer = Buffer.from(str);
    return bs58.encode(buffer);
}

export function stringToUint8Array(input: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(input);
}

export function cleanString(s: string) {
    return s.replace(/\u0000+$/, "");
}

export function bytesToDate(bytes: Uint8Array): Date {
    /**
     * [DEPRECATED]
     */
    const decadeSlice = bytes.slice(0, 10);
    const yearSlice = bytes.slice(10, 19);
    const monthSlice = bytes.slice(19, 30);
    const daySlice = bytes.slice(30, 60);

    const decade = decadeSlice.filter((b) => b === 1).length + 2020;
    const year = yearSlice.filter((b) => b === 1).length + decade;
    const month = monthSlice.filter((b) => b === 1).length;
    const day = daySlice.filter((b) => b === 1).length + 1;

    return new Date(Date.UTC(year, month, day));
}

export function dateToBytes(date: Date): Uint8Array {
    /**
     * [DEPRECATED]
     * Decade (10 bytes): 2020 = 0000000000 -> 2110 = 1111111111
     * Year (9 bytes): 0 = 000000000 -> 9 = 111111111
     * Month (11 bytes):  Jan = 00000000000 -> Dec = 11111111111
     * Day (30 bytes): ..
     * Total (60 bytes): decade|year|month|day
     */

    const year = date.getUTCFullYear();
    const decade = Math.floor(year / 10);
    const dayOfMonth = date.getUTCDate() - 1; // convert to 0 index
    const month = date.getUTCMonth(); // already 0 index

    const monthBytes: Uint8Array = new Uint8Array(11).fill(0).fill(1, 0, month);
    const dayBytes: Uint8Array = new Uint8Array(30)
        .fill(0)
        .fill(1, 0, dayOfMonth);
    const yearBytes: Uint8Array = new Uint8Array(9)
        .fill(0)
        .fill(1, 0, year % 10);
    const decadeBytes: Uint8Array = new Uint8Array(10)
        .fill(0)
        .fill(1, 0, decade - 202); // start from 2020 = 0000000000

    const combinedBytes: Uint8Array = Uint8Array.from([
        ...decadeBytes,
        ...yearBytes,
        ...monthBytes,
        ...dayBytes,
    ]);

    return combinedBytes;
}

export function getDateFilterMask(
    bytes: Uint8Array,
    field: "year" | "month" | "day",
    cmp: "equal" | "lesser" | "greater"
): [number, Uint8Array] {
    /**
     * [DEPRECATED]
     * No decade field, get all the accounts for all decades and filter in frontend (store full date in metadata)
     */

    // get field bytes
    let fieldSlice: Uint8Array;
    if (field === "year") {
        fieldSlice = bytes.slice(10, 19);
    } else if (field === "month") {
        fieldSlice = bytes.slice(19, 30);
    } else {
        fieldSlice = bytes.slice(30, 60);
    }

    // get offset
    let offset: number;
    if (field === "year") {
        offset = 10;
    } else if (field === "month") {
        offset = 10 + 9;
    } else {
        offset = 10 + 9 + 11;
    }

    // get ones
    let ones: number = fieldSlice.filter((b) => b === 1).length;

    // equal
    if (cmp === "equal") {
        return [offset, fieldSlice];
    }
    // lesser
    else if (cmp === "lesser") {
        // ones
        ones = Math.max(ones - 1, 0);

        // get zeros
        let zeros: number;
        if (field === "year") {
            zeros = 9 - ones;
        } else if (field === "month") {
            zeros = 11 - ones;
        } else {
            zeros = 30 - ones;
        }

        // offset
        offset = offset + ones;

        return [offset, new Uint8Array(zeros).fill(0)];
    }
    // greater
    else {
        // ones
        if (field === "year") {
            ones = Math.min(ones + 1, 9);
        } else if (field === "month") {
            ones = Math.min(ones + 1, 11);
        } else {
            ones = Math.min(ones + 1, 30);
        }

        return [offset, new Uint8Array(ones).fill(1)];
    }
}

export function getDateWithinRangeFilterCombinations(date: Date): MemCmp[][] {
    /**
     * [DEPRECATED]
     */
    const dateBytes = dateToBytes(date || new Date());

    const yearLesser = getDateFilterMask(dateBytes, "year", "lesser");
    const yearEqual = getDateFilterMask(dateBytes, "year", "equal");
    const yearGreater = getDateFilterMask(dateBytes, "year", "greater");

    const monthLesser = getDateFilterMask(dateBytes, "month", "lesser");
    const monthEqual = getDateFilterMask(dateBytes, "month", "equal");
    const monthGreater = getDateFilterMask(dateBytes, "month", "greater");

    const dayLesser = getDateFilterMask(dateBytes, "day", "lesser");
    const dayEqual = getDateFilterMask(dateBytes, "day", "equal"); // TODO: WHAT ABOUT EQUAL?
    const dayGreater = getDateFilterMask(dateBytes, "day", "greater");

    const lessYearFilter = [
        {
            memcmp: {
                offset: OFFSET_TO_VALID_FROM + yearLesser[0],
                bytes: bs58.encode(yearLesser[1]),
            },
        },
    ];

    const sameYearLessMonthsFilter = [
        {
            memcmp: {
                offset: OFFSET_TO_VALID_FROM + yearEqual[0],
                bytes: bs58.encode(yearEqual[1]),
            },
        },
        {
            memcmp: {
                offset: OFFSET_TO_VALID_FROM + monthLesser[0],
                bytes: bs58.encode(monthLesser[1]),
            },
        },
    ];

    const sameYearSameMonthsLessDaysFilter = [
        {
            memcmp: {
                offset: OFFSET_TO_VALID_FROM + yearEqual[0],
                bytes: bs58.encode(yearEqual[1]),
            },
        },
        {
            memcmp: {
                offset: OFFSET_TO_VALID_FROM + monthEqual[0],
                bytes: bs58.encode(monthEqual[1]),
            },
        },
        {
            memcmp: {
                offset: OFFSET_TO_VALID_FROM + dayLesser[0],
                bytes: bs58.encode(dayLesser[1]),
            },
        },
    ];

    const greaterYearFilter = [
        {
            memcmp: {
                offset: OFFSET_TO_VALID_TO + yearGreater[0],
                bytes: bs58.encode(yearGreater[1]),
            },
        },
    ];

    const sameYearGreaterMonthsFilter = [
        {
            memcmp: {
                offset: OFFSET_TO_VALID_TO + yearEqual[0],
                bytes: bs58.encode(yearEqual[1]),
            },
        },
        {
            memcmp: {
                offset: OFFSET_TO_VALID_TO + monthGreater[0],
                bytes: bs58.encode(monthGreater[1]),
            },
        },
    ];

    const sameYearSameMonthsGreaterDaysFilter = [
        {
            memcmp: {
                offset: OFFSET_TO_VALID_TO + yearEqual[0],
                bytes: bs58.encode(yearEqual[1]),
            },
        },
        {
            memcmp: {
                offset: OFFSET_TO_VALID_TO + monthEqual[0],
                bytes: bs58.encode(monthEqual[1]),
            },
        },
        {
            memcmp: {
                offset: OFFSET_TO_VALID_TO + dayGreater[0],
                bytes: bs58.encode(dayGreater[1]),
            },
        },
    ];

    return [
        [...lessYearFilter, ...greaterYearFilter],
        [...lessYearFilter, ...sameYearGreaterMonthsFilter],
        [...lessYearFilter, ...sameYearSameMonthsGreaterDaysFilter],

        [...sameYearLessMonthsFilter, ...greaterYearFilter],
        [...sameYearLessMonthsFilter, ...sameYearGreaterMonthsFilter],
        [...sameYearLessMonthsFilter, ...sameYearSameMonthsGreaterDaysFilter],

        [...sameYearSameMonthsLessDaysFilter, ...greaterYearFilter],
        [...sameYearSameMonthsLessDaysFilter, ...sameYearGreaterMonthsFilter],
        [
            ...sameYearSameMonthsLessDaysFilter,
            ...sameYearSameMonthsGreaterDaysFilter,
        ],
    ];
}
