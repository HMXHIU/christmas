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

export function bufferToBinaryString(buffer: Buffer): string {
    return buffer.reduce(
        (acc, byte) => acc.concat(byte.toString(2).padStart(8, "0")),
        ""
    );
}

export function dateToBytes(date: Date): Buffer {
    /**
     * Year (9 bits): 2020 0000000000 -> 2029 1111111111
     * Month (11 bits):  Jan 00000000000 -> Dec 11111111111
     * Day (30 bits): ..
     * Total (50 bits + 14 padding bits = 64 bits or 8 bytes): year|month|day
     */

    const year = date.getUTCFullYear();
    const dayOfMonth = date.getUTCDate() - 1; // convert to 0 index
    const month = date.getUTCMonth(); // already 0 index

    const monthBits: number[] = Array(12).fill(0).fill(1, 0, month);
    const dayBits: number[] = Array(31).fill(0).fill(1, 0, dayOfMonth);
    const yearBits: number[] = Array(10)
        .fill(0)
        .fill(1, 0, year % 10);

    const combinedBits: number[] = [
        ...yearBits,
        ...monthBits,
        ...dayBits,
        ...Array(14).fill(0),
    ];

    let dateBuffer = Buffer.alloc(8);

    for (let i = 0; i < 8; i++) {
        dateBuffer[i] = parseInt(
            combinedBits.slice(i * 8, (i + 1) * 8).join(""),
            2
        );
    }

    return dateBuffer;
}
