import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { getCountriesForTimezone } from "countries-and-timezones";
import { COUNTRY_DETAILS, IPFS_HTTP_GATEWAY } from "./constants";
import geohash from "ngeohash";

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

export async function getUserGeohash(): Promise<string> {
    const { latitude, longitude } = await getDeviceLocation();
    return geohash.encode(latitude, longitude, 6);
}

export function getDeviceLocation(): Promise<GeolocationCoordinates> {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve(position.coords);
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

export function generateQRCodeURL(kwargs: Record<string, string>): string {
    const origin =
        (typeof window !== "undefined" ? window.location.origin : undefined) ||
        "https://${origin}";

    const queryParams = [];

    for (const key in kwargs) {
        if (kwargs.hasOwnProperty(key)) {
            queryParams.push(`${key}=${encodeURIComponent(kwargs[key])}`);
        }
    }

    return `${origin}?${queryParams.sort().join("&")}`;
}

export function extractQueryParams(url: string): Record<string, string> {
    return Object.fromEntries(new URL(url).searchParams.entries());
}

export function nft_uri_to_url(uri: string): string {
    // extract CID from uri
    const regex = /ipfs:\/\/(.+)/;
    const match = uri.match(regex);

    if (!(match && match[1])) {
        throw new Error("nft metadata uri must start with ipfs://");
    }

    return `https://${IPFS_HTTP_GATEWAY}/ipfs/${match[1]}`;
}
