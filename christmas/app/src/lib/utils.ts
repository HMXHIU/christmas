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
import type { TransactionResult } from "./anchorClient/types";

export {
    AsyncLock,
    calculateDistance,
    cleanString,
    confirmTransaction,
    connection,
    extractQueryParams,
    generateRandomSeed,
    generateURL,
    getCurrentTimestamp,
    getErrorMessage,
    imageDataUrlToFile,
    imageUrlToDataURL,
    parseZodErrors,
    retry,
    signAndSendTransaction,
    sleep,
    storage_uri_to_url,
    stringToBase58,
    stringToUint8Array,
    substituteVariables,
    timeStampToDate,
};

const connection = new Connection(PUBLIC_RPC_ENDPOINT, "processed");

function substituteVariables(template: string, variables: Record<string, any>) {
    // Variable access eg. {{target.loc}}
    if (template.startsWith("{{") && template.endsWith("}}")) {
        const parts = template
            .replace(/{{(.*?)}}/g, "$1")
            .trim()
            .split(".");
        let value = variables;
        for (const part of parts) {
            if (value && typeof value === "object" && part in value) {
                value = value[part];
            }
        }
        return value;
    }

    // String substitution eg. ${description}
    return template.replace(/\${(.*?)}/g, (match, v) => {
        const parts = v.trim().split(".");
        let value = variables;
        for (const part of parts) {
            if (value && typeof value === "object" && part in value) {
                value = value[part];
            } else {
                return match;
            }
        }
        return String(value);
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
