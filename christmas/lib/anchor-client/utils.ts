import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

import {
    OFFSET_TO_VALID_FROM_HASH,
    OFFSET_TO_VALID_TO_HASH,
    MS_PER_DAY,
    DAYS_SINCE_1_JAN_2024,
    DATE_HASH_BITS,
    DATE_HASH_SIZE,
    OFFSET_TO_DATE_HASH_OVERFLOW,
} from "./defs";
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

export function epochDaysFromDate(date: number): number {
    return (
        (Math.floor(date / MS_PER_DAY) - DAYS_SINCE_1_JAN_2024) %
        (DATE_HASH_BITS + 1)
    );
}

export function u8ToByteMask(b: number): number {
    const leftShift: number = 8 - b;

    switch (leftShift) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
            return (0xff << leftShift) & 0xff; // force js u8
        case 8:
            return 0x00;
        default:
            throw new Error("Input should be in the range 0 to 8");
    }
}

export function daysToByteMask(days: number): Uint8Array {
    const mdays: number = days % (DATE_HASH_BITS + 1);
    const fullBytes: number = Math.floor(mdays / 8);
    const halfByte: number = mdays % 8;
    const byteMask: Uint8Array = new Uint8Array(DATE_HASH_SIZE).fill(0);

    // Fill in full bytes
    for (let i = 0; i < fullBytes; i++) {
        byteMask[i] = 0xff;
    }

    // Fill in half byte
    if (fullBytes < DATE_HASH_SIZE) {
        byteMask[fullBytes] = u8ToByteMask(halfByte);
    }

    return byteMask;
}

/**
 * Calculates the offset and byte mask for date >= comparison.
 *
 * @param {number} dateInMilliseconds - The date in milliseconds.
 * @returns {[number, Uint8Array] | null} - [offset, byte mask for compare], null means filter allow all.
 */
export function getDateGreaterThanOrEqualByteMask(
    dateInMilliseconds: number
): [number, Uint8Array] | null {
    const byteMask = daysToByteMask(epochDaysFromDate(dateInMilliseconds));

    let fullByteMask = [];

    for (const b of byteMask) {
        if (b === 0xff) {
            fullByteMask.push(0xff);
        }
    }

    if (fullByteMask.length > 0) {
        return [0, Uint8Array.from(fullByteMask)];
    } else {
        return null;
    }
}

/**
 * Calculates the offset and byte mask for date <= comparison.
 *
 * @param {number} dateInMilliseconds - The date in milliseconds.
 * @returns {[number, Uint8Array] | null} - [offset, byte mask for compare], null means filter allow all.
 */
export function getDateLessThanOrEqualByteMask(
    dateInMilliseconds: number
): [number, Uint8Array] | null {
    const byteMask = daysToByteMask(epochDaysFromDate(dateInMilliseconds));
    let offset = 0;

    // set the offset to the first 0x00 byte
    for (const b of byteMask) {
        if (b === 0xff) {
            offset += 1;
        } else if (b === 0x00) {
            // this is the offset of the first 0x00
            break;
        } else {
            // this is the last half byte, the next byte is 0x00
            offset += 1;
            break;
        }
    }

    if (offset < DATE_HASH_SIZE) {
        return [offset, new Uint8Array(DATE_HASH_SIZE - offset).fill(0)];
    } else {
        return null;
    }
}

/**
 * Generate memory comparison filters such that VALID_FROM_HASH < date < VALID_TO_HASH.
 *
 * case 1: no overflow
 *
 * validFrom: 1111111111000000000000000
 * validTo: 1111111111111111111000000
 * overflow: false // validFrom < validTo
 * date: 1111111111111000000000000
 *
 * case 2a: validTo overflow, today has not overflow
 * date is lesser than validTo but because of overflow of validTo it is now greater, we cant tell by comparing `111111111111111111111`
 * match overflow=1 && validFrom < date `0000`
 *
 * validFrom: 1111111111111111111000000
 * validTo: 1110000000000000000000000
 * overflow: true // validTo < validFrom
 * date: 1111111111111111111110000
 *
 * case 2b: validTo overflow, today has overflow
 * date it is greater than validFrom because of overflow, but we cant tell from comparing `00000000000000000000000` as it will fail
 * match overflow=1 && validTo > date `11`
 *
 * validFrom: 1111111111111111111000000
 * validTo: 1110000000000000000000000
 * overflow: true // validTo < validFrom
 * date: 1100000000000000000000000
 *
 * case 3: validTo & validFrom overflow (indistinguishable from case 1 (no need to handle))
 *
 * validFrom: 1100000000000000000000000
 * validTo: 1110000000000000000000000
 * overflow: false
 * date: 1111111111111111111110000
 *
 * Thus need to do 3 queries
 *
 * 1. normal
 * 2. match overflow=1 && validTo > date
 * 3. match overflow=1 && validFrom < date
 *
 * @param {Date} date - The date for which to generate filter combinations.
 * @returns {MemCmp[][]} An array of memory comparison filter combinations.
 */
export function getDateWithinRangeFilterCombinations(date: Date): MemCmp[][] {
    const now = (date || new Date()).getTime();

    const validFromMask = getDateLessThanOrEqualByteMask(now);
    const validToMask = getDateGreaterThanOrEqualByteMask(now);

    const validFromFilter =
        validFromMask != null
            ? [
                  {
                      memcmp: {
                          offset: OFFSET_TO_VALID_FROM_HASH + validFromMask[0],
                          bytes: bs58.encode(validFromMask[1]),
                      },
                  },
              ]
            : [];

    const validToFilter =
        validToMask != null
            ? [
                  {
                      memcmp: {
                          offset: OFFSET_TO_VALID_TO_HASH + validToMask[0],
                          bytes: bs58.encode(validToMask[1]),
                      },
                  },
              ]
            : [];

    const overflowTrueFilter = [
        {
            memcmp: {
                offset: OFFSET_TO_DATE_HASH_OVERFLOW,
                bytes: bs58.encode(Uint8Array.from([1])),
            },
        },
    ];

    return [
        [...validFromFilter, ...validToFilter],
        [...overflowTrueFilter, ...validToFilter],
        [...overflowTrueFilter, ...validFromFilter],
    ];
}

export function getMarketCouponsFilterCombinations({
    date,
    region,
    geohash,
}: {
    date: Date;
    region: string;
    geohash: string;
}): MemCmp[][] {
    const now = (date || new Date()).getTime();

    const validFromMask = getDateLessThanOrEqualByteMask(now);
    const validToMask = getDateGreaterThanOrEqualByteMask(now);

    // const regionMask =

    // // region
    // {
    //     memcmp: {
    //         offset: OFFSET_TO_REGION + STRING_PREFIX_SIZE,
    //         bytes: stringToBase58(region),
    //     },
    // },
    // // has supply
    // {
    //     memcmp: {
    //         offset: OFFSET_TO_HAS_SUPPLY,
    //         bytes: bs58.encode(Uint8Array.from([1])),
    //     },
    // },
    // // within range
    // {
    //     memcmp: {
    //         offset: OFFSET_TO_GEO + STRING_PREFIX_SIZE,
    //         bytes: stringToBase58(geo.slice(0, -1)), // reduce 1 precision level to get surrounding (TODO: this is not accurate for borders)
    //     },
    // },

    const validFromFilter =
        validFromMask != null
            ? [
                  {
                      memcmp: {
                          offset: OFFSET_TO_VALID_FROM_HASH + validFromMask[0],
                          bytes: bs58.encode(validFromMask[1]),
                      },
                  },
              ]
            : [];

    const validToFilter =
        validToMask != null
            ? [
                  {
                      memcmp: {
                          offset: OFFSET_TO_VALID_TO_HASH + validToMask[0],
                          bytes: bs58.encode(validToMask[1]),
                      },
                  },
              ]
            : [];

    const overflowTrueFilter = [
        {
            memcmp: {
                offset: OFFSET_TO_DATE_HASH_OVERFLOW,
                bytes: bs58.encode(Uint8Array.from([1])),
            },
        },
    ];

    return [
        [...validFromFilter, ...validToFilter],
        [...overflowTrueFilter, ...validToFilter],
        [...overflowTrueFilter, ...validFromFilter],
    ];
}
