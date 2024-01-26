import { json } from "@sveltejs/kit";
import {
    PUBLIC_FEE_PAYER_PUBKEY,
    PUBLIC_RPC_ENDPOINT,
} from "$env/static/public";
import { FEE_PAYER_PRIVATE_KEY as FEE_PAYER_PRIVATE_KEY_JSON } from "$env/static/private";
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";
import { AnchorClient } from "$lib/clients/anchor-client/anchorClient";
import { GEOHASH_SIZE, PROGRAM_ID } from "$lib/clients/anchor-client/defs";
import { Wallet as AnchorWallet } from "@coral-xyz/anchor";
import { COUNTRY_DETAILS } from "$lib/clients/user-device-client/defs";

import { parseURL } from "@solana/pay";

// Load keypair
const FEE_PAYER_PUBKEY = new PublicKey(PUBLIC_FEE_PAYER_PUBKEY);
const FEE_PAYER_PRIVATE_KEY = new Uint8Array(
    JSON.parse(FEE_PAYER_PRIVATE_KEY_JSON),
);

// Create anchor client using FEE_PAYER_PRIVATE_KEY
const anchorClient = new AnchorClient({
    programId: new PublicKey(PROGRAM_ID),
    anchorWallet: new AnchorWallet(
        Keypair.fromSecretKey(FEE_PAYER_PRIVATE_KEY),
    ),
    cluster: PUBLIC_RPC_ENDPOINT,
});

/** @type {import('@sveltejs/kit').RequestHandler} */
export const GET = (event: any) => {
    let label = "Community";
    let icon =
        "https://en.wikipedia.org/wiki/Community_%28TV_series%29#/media/File:Community_title.jpg";

    return json({
        label,
        icon,
    });
};

/** @type {import('@sveltejs/kit').RequestHandler} */
export const POST = async (event: any) => {
    // Get request body and url parameters
    let body = await event.request.json();
    let signer_ip = event.request.headers.get("x-forwarded-for");

    const solanaPayParameters = parseURL(event.url);
    console.log(JSON.stringify(solanaPayParameters, null, 2));

    return json({
        transaction: "base64Transaction", // return serialized partially signed transaction
        message: solanaPayParameters.message,
    });
};
