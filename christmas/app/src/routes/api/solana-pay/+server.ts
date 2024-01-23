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
} from "@solana/web3.js";
import { AnchorClient } from "$lib/clients/anchor-client/anchorClient";
import { PROGRAM_ID } from "$lib/clients/anchor-client/defs";
import { Wallet as AnchorWallet } from "@coral-xyz/anchor";

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
    let urlParams = event.url.searchParams;
    let signer_ip = event.request.headers.get("x-forwarded-for");

    // Get solana pay parameters
    const { label, message, recipient } = _getSolanaPayParams(urlParams);

    // Get procedure instruction
    const { procedure, parameters } = body;
    const procedureIx = await _getProcedureIx(body);
    if (procedureIx == null) {
        throw new Error("Invalid procedure");
    }

    console.log(`
    [${signer_ip} -> ${procedure}]
    label: ${label}
    message: ${message}
    recipient: ${recipient}
    `);

    // Set up connection and signer
    const connection = new Connection(PUBLIC_RPC_ENDPOINT, "processed");
    let signer = Keypair.fromSecretKey(FEE_PAYER_PRIVATE_KEY);

    // Get latest blockchash and block height
    let latestBlockHash = await connection.getLatestBlockhash();

    // Create tx with recent blockhash and splTransferIx
    let tx = new Transaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        feePayer: FEE_PAYER_PUBKEY,
    });

    // Add procedure instruction
    tx.add(procedureIx);

    // Partially sign to take on fees
    tx.partialSign(signer);

    // Serialize partially signed transaction.
    const serializedTransaction = tx.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
    });
    const base64Transaction = serializedTransaction.toString("base64");

    return json({
        transaction: base64Transaction,
        message: message,
    });
};

export function _getSolanaPayParams(urlParams: URLSearchParams) {
    // Get label from urlParams
    let label = urlParams.get("label");
    if (!label || typeof label !== "string") throw new Error("invalid label");

    // Get message from urlParams
    let message = urlParams.get("message");
    if (!message || typeof message !== "string")
        throw new Error("invalid message");

    // Get recipient from urlParams
    let recipient = urlParams.get("recipient");
    if (!recipient || typeof recipient !== "string")
        throw new Error("missing recipient");

    return {
        label,
        message,
        recipient,
    };
}

export async function _getProcedureIx({
    procedure,
    parameters,
}: {
    procedure: string;
    parameters: any;
}): Promise<TransactionInstruction | null> {
    if (procedure === "claimFromMarket") {
        return await _getClaimFromMarketProcedureIx(parameters);
    } else if (procedure === "createUser") {
        return await _getCreateUserProdecureIx(parameters);
    }

    return null;
}

function _getClaimFromMarketProcedureIx(
    parameters: any,
): Promise<TransactionInstruction> {
    // check wallet is a valid string
    if (!parameters.wallet || typeof parameters.wallet !== "string")
        throw new Error("Invalid wallet");

    // check numtokens is a number > 0
    if (!parameters.numTokens || typeof parameters.numTokens !== "number")
        throw new Error("Invalid numTokens");

    // check mint is a valid string
    if (!parameters.mint || typeof parameters.mint !== "string")
        throw new Error("Invalid mint");

    return anchorClient.claimFromMarketIx({
        mint: new PublicKey(parameters.mint),
        numTokens: parameters.numTokens,
        wallet: new PublicKey(parameters.wallet),
    });
}

function _getCreateUserProdecureIx(
    parameters: any,
): Promise<TransactionInstruction> {
    // check wallet is a valid string
    if (!parameters.wallet || typeof parameters.wallet !== "string")
        throw new Error("Invalid wallet");

    // check region is a valid string
    if (!parameters.region || typeof parameters.region !== "string")
        throw new Error("Invalid region");

    // check geohash is a valid string
    if (!parameters.geohash || typeof parameters.geohash !== "string")
        throw new Error("Invalid geohash");

    return anchorClient.createUserIx({
        wallet: new PublicKey(parameters.wallet),
        region: parameters.region,
        geohash: parameters.geohash,
    });
}
