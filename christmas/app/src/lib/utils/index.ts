import {
    Connection,
    type Commitment,
    type SerializeConfig,
    type Transaction,
    type VersionedTransaction,
    type SendOptions,
} from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";
import type { TransactionResult } from "../anchorClient/types";
import { PUBLIC_RPC_ENDPOINT } from "$env/static/public";

export {
    connection,
    cleanString,
    calculateDistance,
    timeStampToDate,
    generateURL, // TODO: Use general URL functions and deprecate this
    extractQueryParams,
    fetchData, // TODO: Use general fetch and deprecate this
    storage_uri_to_url,
    signAndSendTransaction,
    confirmTransaction,
    uploadImage,
    stringToUint8Array,
    stringToBase58,
    getErrorMessage,
};

const connection = new Connection(PUBLIC_RPC_ENDPOINT, "processed");

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

function generateURL(kwargs: Record<string, string>, uri?: string): string {
    const origin =
        (typeof window !== "undefined" ? window.location.origin : undefined) ||
        "https://${origin}";

    const queryParams: string[] = [];

    for (const key in kwargs) {
        if (kwargs.hasOwnProperty(key)) {
            queryParams.push(`${key}=${encodeURIComponent(kwargs[key])}`);
        }
    }
    const url = uri ? new URL(uri, origin) : origin;

    return `${url}?${queryParams.sort().join("&")}`;
}

function extractQueryParams(url: string): Record<string, string> {
    return Object.fromEntries(new URL(url).searchParams.entries());
}

function fetchData(url: string, defaultValue: any = {}): Promise<any> {
    if (url) {
        return fetch(url)
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! Status: ${res.status}`);
                }
                return res.json();
            })
            .catch((error) => {
                console.warn(`Could not fetch ${url}`);
                return defaultValue; // Return the specified default value on error
            });
    }
    return defaultValue;
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

async function uploadImage(imageFile: File) {
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    const response = await fetch(`/api/storage/image/public`, {
        method: "POST",
        headers: {
            "Content-Type": "image",
        },
        body: imageBuffer,
    });

    const { status, url } = await response.json();

    if (status === "success") {
        return url;
    }

    throw new Error("Failed to upload image");
}