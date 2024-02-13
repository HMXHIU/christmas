import { PUBLIC_RPC_ENDPOINT } from "$env/static/public";
import type { UserMetadata } from "$lib/clients/anchor-client/types";
import { COUNTRY_DETAILS } from "$lib/clients/user-device-client/defs";
import {
    FEE_PAYER_PUBKEY,
    feePayerKeypair,
    serverAnchorClient,
} from "$lib/server";
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";
import { json } from "@sveltejs/kit";

/** @type {import('@sveltejs/kit').RequestHandler} */
export const POST = async (event: any) => {
    // Get request body and url parameters
    let body = await event.request.json();

    // Get procedure instruction
    const { procedure, parameters } = body;
    console.log(`
        procedure: ${procedure}
        parameters: ${JSON.stringify(parameters, null, 2)}
    `);
    const procedureIx = await _getProcedureIx(body);

    // Create serialized transaction
    const base64Transaction = await _createSerializedTransaction(procedureIx);

    return json({
        transaction: base64Transaction,
    });
};

async function _createSerializedTransaction(ix: TransactionInstruction) {
    // Set up connection and signer
    const connection = new Connection(PUBLIC_RPC_ENDPOINT, "processed");

    // Get latest blockchash and block height
    let latestBlockHash = await connection.getLatestBlockhash();

    // Create tx with recent blockhash and splTransferIx
    let tx = new Transaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        feePayer: FEE_PAYER_PUBKEY, // pay for transaction fee
    });

    // Add procedure instruction
    tx.add(ix);

    // Partially sign to take on fees
    tx.partialSign(feePayerKeypair);

    // Serialize partially signed transaction (serialize verification done on client side).
    const serializedTransaction = tx.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
    });
    const base64Transaction = serializedTransaction.toString("base64");

    return base64Transaction;
}

async function _getProcedureIx({
    procedure,
    parameters,
}: {
    procedure: string;
    parameters: any;
}): Promise<TransactionInstruction> {
    if (procedure === "claimFromMarket") {
        return await _getClaimFromMarketProcedureIx(parameters);
    } else if (procedure === "createUser") {
        return await _getCreateUserProdecureIx(parameters);
    } else if (procedure === "redeemCoupon") {
        return await _getRedeemCouponIx(parameters);
    }

    throw new Error(`Invalid procedure: ${procedure}`);
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

    return serverAnchorClient.claimFromMarketIx({
        mint: new PublicKey(parameters.mint),
        numTokens: parameters.numTokens,
        wallet: new PublicKey(parameters.wallet),
        payer: FEE_PAYER_PUBKEY,
    });
}

function _getCreateUserProdecureIx(
    parameters: any,
): Promise<TransactionInstruction> {
    // check wallet is a valid string
    if (!parameters.wallet || typeof parameters.wallet !== "string")
        throw new Error("Invalid wallet");

    // check valid region (TODO: check should be moved into AnchorClient or backend)
    try {
        COUNTRY_DETAILS[String.fromCharCode(...parameters.region)];
    } catch (error) {
        throw new Error(`Invalid region: ${parameters.region}`);
    }

    return serverAnchorClient.createUserIx({
        wallet: new PublicKey(parameters.wallet),
        payer: FEE_PAYER_PUBKEY,
        region: parameters.region,
        uri: parameters.uri || "",
    });
}

function _getRedeemCouponIx(parameters: any): Promise<TransactionInstruction> {
    // check wallet is a valid string
    if (!parameters.wallet || typeof parameters.wallet !== "string")
        throw new Error("Invalid wallet");

    // check coupon is a valid string
    if (!parameters.coupon || typeof parameters.coupon !== "string")
        throw new Error("Invalid coupon");

    // check numtokens is a number > 0
    if (!parameters.numTokens || typeof parameters.numTokens !== "number")
        throw new Error("Invalid numTokens");

    // check mint is a valid string
    if (!parameters.mint || typeof parameters.mint !== "string")
        throw new Error("Invalid mint");

    return serverAnchorClient.redeemCouponIx({
        wallet: new PublicKey(parameters.wallet),
        payer: FEE_PAYER_PUBKEY,
        coupon: new PublicKey(parameters.coupon),
        numTokens: parameters.numTokens,
        mint: new PublicKey(parameters.mint),
    });
}
