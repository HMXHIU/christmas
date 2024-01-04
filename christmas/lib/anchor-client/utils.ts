import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

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

export function bnToBinaryString(bn: anchor.BN): string {
    return bn
        .toArrayLike(Buffer, "be")
        .reduce(
            (acc, byte) => acc.concat(byte.toString(2).padStart(8, "0")),
            ""
        )
        .padStart(64, "0"); // BN removes leading zeros, need to add it back
}

export function bnToDate(bn: anchor.BN): Date {
    const binaryString = bnToBinaryString(bn);

    const decadeSlice = binaryString.slice(0, 10);
    const yearSlice = binaryString.slice(10, 19);
    const monthSlice = binaryString.slice(19, 30);
    const daySlice = binaryString.slice(30, 60);

    const decade = (decadeSlice.match(/1/g) || []).length + 2020;
    const year = (yearSlice.match(/1/g) || []).length + decade;
    const month = (monthSlice.match(/1/g) || []).length;
    const day = (daySlice.match(/1/g) || []).length + 1;

    return new Date(Date.UTC(year, month, day));
}

export function dateToBN(date: Date): anchor.BN {
    /**
     * Decade (10 bits): 2020 = 0000000000 -> 2110 = 1111111111
     * Year (9 bits): 0 = 000000000 -> 9 = 111111111
     * Month (11 bits):  Jan = 00000000000 -> Dec = 11111111111
     * Day (30 bits): ..
     * Total (60 bits + 4 padding bits = 64 bits or 8 bytes): decade|year|month|day
     */

    const year = date.getUTCFullYear();
    const decade = Math.floor(year / 10);
    const dayOfMonth = date.getUTCDate() - 1; // convert to 0 index
    const month = date.getUTCMonth(); // already 0 index

    const monthBits: number[] = Array(11).fill(0).fill(1, 0, month);
    const dayBits: number[] = Array(30).fill(0).fill(1, 0, dayOfMonth);
    const yearBits: number[] = Array(9)
        .fill(0)
        .fill(1, 0, year % 10);
    const decadeBits: number[] = Array(10)
        .fill(0)
        .fill(1, 0, decade - 202); // start from 2020 = 0000000000

    const combinedBits: number[] = [
        ...decadeBits,
        ...yearBits,
        ...monthBits,
        ...dayBits,
        ...Array(4).fill(0),
    ];

    let dateBuffer = Buffer.alloc(8);

    for (let i = 0; i < 8; i++) {
        dateBuffer[i] = parseInt(
            combinedBits.slice(i * 8, (i + 1) * 8).join(""),
            2
        );
    }

    return new anchor.BN(dateBuffer, "be");
}
