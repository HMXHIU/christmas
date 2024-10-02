import { PUBLIC_RPC_ENDPOINT } from "$env/static/public";
import type { TransactionResult } from "$lib/community/types";
import {
    Connection,
    type Commitment,
    type SendOptions,
    type SerializeConfig,
    type Transaction,
    type VersionedTransaction,
} from "@solana/web3.js";

export {
    confirmTransaction,
    connection,
    signAndSendTransaction,
    storage_uri_to_url,
};

const connection = new Connection(PUBLIC_RPC_ENDPOINT, "processed");

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
