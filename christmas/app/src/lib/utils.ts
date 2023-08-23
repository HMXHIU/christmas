import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { getCountriesForTimezone } from "countries-and-timezones";
import { COUNTRY_DETAILS } from "./constants";

export function stringToBase58(str: string) {
    const buffer = Buffer.from(str);
    return bs58.encode(buffer);
}

export function stringToUint8Array(input: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(input);
}

export function getUserPda(user: web3.PublicKey, programId: web3.PublicKey) {
    return web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("user"), user.toBuffer()],
        programId
    );
}

export function cleanString(s: string) {
    return s.replace(/\u0000+$/, "");
}

export function getUserGeolocation(): Promise<{
    latitude: number;
    longitude: number;
}> {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    resolve({ latitude, longitude });
                },
                (error) => {
                    reject(new Error("Failed to retrieve geolocation."));
                }
            );
        } else {
            reject(new Error("Geolocation is not supported by this browser."));
        }
    });
}

export function getTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getUserCountry(): { code: string; name: string } {
    const first = getCountriesForTimezone(getTimezone())[0];
    return {
        code: COUNTRY_DETAILS[first.id][0] || "USA",
        name: first.name,
    };
}
