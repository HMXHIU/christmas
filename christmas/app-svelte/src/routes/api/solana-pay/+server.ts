import { json } from "@sveltejs/kit";
import {
    PUBLIC_FEE_PAYER_PUBKEY,
    PUBLIC_RPC_ENDPOINT,
} from "$env/static/public";
import { FEE_PAYER_PRIVATE_KEY as FEE_PAYER_PRIVATE_KEY_JSON } from "$env/static/private";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";

// Load keypair
const FEE_PAYER_PUBKEY = new PublicKey(PUBLIC_FEE_PAYER_PUBKEY);
const FEE_PAYER_PRIVATE_KEY = new Uint8Array(
    JSON.parse(FEE_PAYER_PRIVATE_KEY_JSON),
);

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
    let body = await event.request.json();
    let urlParams = event.url.searchParams;
    let signer_ip = event.request.headers.get("x-forwarded-for");

    // Validate parameters
    const { label, message, recipient, account } = _validateParams(
        urlParams,
        body,
    );

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

export function _validateParams(urlParams: URLSearchParams, body: any) {
    let labelParam = urlParams.get("label");
    if (labelParam && typeof labelParam !== "string")
        throw new Error("invalid label");
    let label = labelParam || undefined;

    let messageParam = urlParams.get("message");
    if (messageParam && typeof messageParam !== "string")
        throw new Error("invalid message");
    let message = messageParam || undefined;

    let recipientParam = urlParams.get("recipient");
    if (!recipientParam) throw new Error("missing recipient");
    if (typeof recipientParam !== "string")
        throw new Error("invalid recipient");
    let recipient = new PublicKey(recipientParam);

    // Account provided in the transaction request body by the wallet.
    let account = body.account;
    if (!account) throw new Error("missing account");
    if (typeof account !== "string") throw new Error("invalid account");

    return {
        label,
        message,
        recipient,
        account,
    };
}
