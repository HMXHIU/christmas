import { COUNTRY_DETAILS } from "$lib/clients/user-device-client/defs";
import { stringToUint8Array } from "$lib/utils";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

export function getCookiesFromResponse(response: Response): string {
    let cookies: string[] = [];

    response.headers.forEach((value, name) => {
        console.log(name, value);
        if (name.toLowerCase() === "set-cookie") {
            cookies.push(...value.split(",")); // multiple set-cookie headers
        }
    });

    return cookies.join("; ");
}

export function readImageAsBuffer(imagePath: string): Buffer {
    const absolutePath = path.resolve(__dirname, imagePath);
    return fs.readFileSync(absolutePath);
}

export function getRandomDate(startYear: number, endYear: number): Date {
    const year =
        Math.floor(Math.random() * (endYear - startYear + 1)) + startYear;
    const month = Math.floor(Math.random() * 12);
    const day = Math.floor(Math.random() * 28) + 1; // To ensure valid date for all months
    return new Date(Date.UTC(year, month, day));
}

export function getRandomRegion(): number[] {
    const regionIdx = Math.floor(
        Math.random() * Object.values(COUNTRY_DETAILS).length,
    );
    const regionCode = Object.values(COUNTRY_DETAILS)[regionIdx][0];
    return Array.from(stringToUint8Array(regionCode));
}
