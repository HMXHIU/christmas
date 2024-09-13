import { PUBLIC_RPC_ENDPOINT } from "$env/static/public";
import {
    Connection,
    type Commitment,
    type SendOptions,
    type SerializeConfig,
    type Transaction,
    type VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";
import { z } from "zod";
import type { TransactionResult } from "../anchorClient/types";

export {
    AsyncLock,
    calculateDistance,
    cleanString,
    confirmTransaction,
    connection,
    divmod,
    extractQueryParams,
    generatePin,
    generateRandomSeed,
    generateURL,
    getCurrentTimestamp,
    getErrorMessage,
    imageDataUrlToFile,
    imageUrlToDataURL,
    isBrowser,
    parseZodErrors,
    retry,
    sampleFrom,
    seededRandom,
    signAndSendTransaction,
    sleep,
    storage_uri_to_url,
    stringToBase58,
    stringToRandomNumber,
    stringToUint8Array,
    substituteValues,
    substituteVariables,
    timeStampToDate,
};

const connection = new Connection(PUBLIC_RPC_ENDPOINT, "processed");

/**
 * Converts a string (seed) to a random number.
 *
 * @param str - The string to convert.
 * @returns The random number generated from the string (seed).
 */
function stringToRandomNumber(str: string): number {
    var hash = 0;
    if (str.length === 0) return hash;
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char; // Bitwise left shift and subtraction
        hash &= hash; // Convert to 32bit integer
    }
    return Math.abs(hash); // Ensure positive number
}

/**
 * Generates a seeded random number between 0 and 1.
 *
 * @param seed - The seed value used to generate the random number.
 * @returns A random number between 0 (inclusive) and 1 (exclusive).
 */
function seededRandom(seed: number): number {
    var x = Math.sin(seed) * 10000; // how many decimal places
    return x - Math.floor(x);
}

function substituteValues(
    d: Record<string, string>,
    variables: Record<string, any>,
) {
    const result: Record<string, string> = {};

    for (const key in d) {
        if (d.hasOwnProperty(key)) {
            result[key] = substituteVariables(d[key], variables);
        }
    }

    return result;
}

function substituteVariables(template: string, variables: Record<string, any>) {
    // TODO: replace with lodash get
    function getValueFromPath(obj: any, path: string): any {
        return path
            .split(/\.|\[|\]/g)
            .filter(Boolean) // Remove any empty strings from the array
            .reduce((acc, key) => acc && acc[key], obj);
    }

    // TODO: this should be a different function
    // Variable access eg. {{target.loc}} or {{points[0]}}
    // This returns the variable directly (vs string)
    if (template.startsWith("{{") && template.endsWith("}}")) {
        const path = template.replace(/{{(.*?)}}/g, "$1").trim();
        return getValueFromPath(variables, path);
    }

    // String substitution eg. ${description} or ${points[0]}
    return template.replace(/\${(.*?)}/g, (match, v) => {
        const path = v.trim();
        const value = getValueFromPath(variables, path);
        return value !== undefined ? String(value) : match;
    });
}

function cleanString(s: string) {
    return s.replace(/\u0000+$/, "");
}

function stringToBase58(str: string) {
    const buffer = Buffer.from(str);
    return bs58.encode(buffer);
}

function stringToUint8Array(input: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(input);
}

function getCurrentTimestamp(date: Date): string {
    const timestamp = (date || new Date()).toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
    });
    return timestamp; // somehow need to store it in a variable (directly returning is undefined)
}

function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 6371; // Earth's radius in kilometers

    // Convert latitudes from degrees to radians
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const lon1Rad = (lon1 * Math.PI) / 180;
    const lon2Rad = (lon2 * Math.PI) / 180;

    const x = (lon2Rad - lon1Rad) * Math.cos((lat1Rad + lat2Rad) / 2);
    const y = lat2Rad - lat1Rad;

    // Distance using Equirectangular approximation
    const distance = Math.sqrt(x * x + y * y) * R;

    return distance;
}

function timeStampToDate(timeStamp: BN): Date {
    return new Date(timeStamp.toNumber());
}

function getErrorMessage(error: any): string {
    // Parse error if its a JSON string
    try {
        error = JSON.parse(error);
    } catch (e) {}

    // Drill down to find message string
    if (error.message) {
        if (typeof error.message === "string") {
            return error.message;
        } else if (typeof error.message.message === "string") {
            return error.message.message;
        }
    } else if (typeof error === "string") {
        return error;
    }
    // parse error to string
    return JSON.stringify(error);
}

function generateURL(kwargs: Record<string, string>, uri?: string) {
    const origin =
        (typeof window !== "undefined" ? window.location.origin : undefined) ||
        "https://${origin}";

    const queryParams = new URLSearchParams();

    for (const key in kwargs) {
        if (kwargs.hasOwnProperty(key)) {
            queryParams.append(key, kwargs[key]);
        }
    }

    const url = uri ? new URL(uri, origin) : new URL(origin);
    queryParams.sort();
    url.search = queryParams.toString();

    return url.toString();
}

function extractQueryParams(url: string): Record<string, string> {
    return Object.fromEntries(new URL(url).searchParams.entries());
}

function storage_uri_to_url(uri: string): string {
    const PUBLIC_IPFS_HTTP_GATEWAY = "ipfs.io";

    // Replace with uri prefixes (eg. IPFS) with public gateways
    const regex = /ipfs:\/\/(.+)/;
    const match = uri.match(regex);
    if (match && match[1]) {
        return `https://${PUBLIC_IPFS_HTTP_GATEWAY}/ipfs/${match[1]}`;
    }
    return uri;
}

async function signAndSendTransaction({
    tx,
    options,
    serializeConfig,
    skipSign,
    wallet,
    commitment,
}: {
    tx: Transaction | VersionedTransaction;
    options?: SendOptions;
    serializeConfig?: SerializeConfig;
    skipSign?: boolean;
    wallet?: any;
    commitment?: Commitment;
}): Promise<TransactionResult> {
    options = options || {};
    skipSign = skipSign || false;

    // defaults to window.solana
    wallet = wallet || (window as any).solana;

    // sign
    const signedTx = skipSign ? tx : await wallet.signTransaction(tx);

    // send transaction
    const signature = await connection.sendRawTransaction(
        signedTx.serialize(serializeConfig),
        options,
    );

    // confirm transaction
    return await confirmTransaction(signature, commitment);
}

async function confirmTransaction(
    signature: string,
    commitment?: Commitment,
): Promise<TransactionResult> {
    const bh = await connection.getLatestBlockhash();
    const result = (
        await connection.confirmTransaction(
            {
                blockhash: bh.blockhash,
                lastValidBlockHeight: bh.lastValidBlockHeight,
                signature: signature,
            },
            commitment,
        )
    ).value;
    return { result, signature };
}

async function imageDataUrlToFile(
    imageDataUrl: string,
): Promise<{ mimeType: string; file: File }> {
    // Split the data URL to extract MIME type and base64 data
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
        throw new Error("Invalid Image Data URL");
    }
    const [, mimeType, base64Data] = match;

    // Convert base64 to binary
    const binaryData = atob(base64Data);
    const dataArray = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
        dataArray[i] = binaryData.charCodeAt(i);
    }

    // Create Blob from binary data
    const blob = new Blob([dataArray], { type: mimeType });

    // Create File from Blob
    const file = new File([blob], `image.${mimeType.split("/")[1]}`, {
        type: mimeType,
    });

    return { mimeType, file };
}

async function imageUrlToDataURL(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
            } else {
                reject(new Error("Failed to convert image to data URL."));
            }
        };
        reader.onerror = () => {
            reject(new Error("Failed to read the image."));
        };
        reader.readAsDataURL(blob);
    });
}

function parseZodErrors(err: any): Record<string, string> {
    let errors: Record<string, string> = {};
    if (err instanceof z.ZodError) {
        for (const { path, message } of err.issues) {
            errors[path[0]] = message;
        }
    }
    return errors;
}

/**
 * Retries the provided asynchronous function with a specified number of attempts and delay between each attempt.
 * If an error occurs during any attempt, it will retry the function until the maximum number of attempts is reached.
 * An optional remedy function can be provided to perform a specific action before the second attempt.
 *
 * @param fn - The asynchronous function to retry.
 * @param maxAttempts - The maximum number of attempts to make.
 * @param delay - The delay in milliseconds between each attempt.
 * @param remedyFn - An optional function to perform a specific action before the second attempt.
 * @returns A promise that resolves to the result of the successful attempt.
 * @throws If the maximum number of attempts is reached without a successful attempt.
 */
async function retry<T>({
    fn,
    maxAttempts,
    delay,
    remedyFn,
}: {
    fn: () => Promise<T>;
    maxAttempts?: number;
    delay?: number;
    remedyFn?: () => Promise<void>;
}): Promise<T> {
    maxAttempts = maxAttempts ?? 2;
    delay = delay ?? 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxAttempts) {
                throw new Error("Max retry attempts.");
            }
            if (remedyFn && attempt === 0) {
                console.log("Retrying with remedy function...");
                await remedyFn();
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw new Error("Max retry attempts.");
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
 *Generate a random seed for use in stable diffusion
 */
function generateRandomSeed(): number {
    // Define the range for the seed, e.g., 0 to 2^32 - 1
    const maxSeed = Math.pow(2, 32) - 1;
    // Generate a random integer within the range
    const randomSeed = Math.floor(Math.random() * maxSeed);
    return randomSeed;
}
class AsyncLock {
    private locked: boolean = false;
    private waitingQueue: (() => void)[] = [];

    async acquire(): Promise<void> {
        if (!this.locked) {
            this.locked = true;
            return;
        }

        return new Promise<void>((resolve) => {
            this.waitingQueue.push(resolve);
        });
    }

    release(): void {
        if (this.waitingQueue.length > 0) {
            const nextResolve = this.waitingQueue.shift();
            nextResolve?.();
        } else {
            this.locked = false;
        }
    }

    async withLock<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}

function divmod(n: number, d: number): [number, number] {
    return [Math.floor(n / d), n % d];
}

function isBrowser(): boolean {
    return typeof window !== "undefined";
}

function sampleFrom<T>(items: T[], count: number, seed: number): T[] {
    const shuffled = [...items];
    let currentIndex = shuffled.length;
    let randomIndex: number;

    while (currentIndex !== 0) {
        randomIndex = Math.floor(seededRandom(seed++) * currentIndex);
        currentIndex--;

        [shuffled[currentIndex], shuffled[randomIndex]] = [
            shuffled[randomIndex],
            shuffled[currentIndex],
        ];
    }

    return shuffled.slice(0, count);
}

function generatePin(length: number) {
    if (length <= 0) return "";

    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;

    return Math.floor(min + Math.random() * (max - min + 1)).toString();
}
