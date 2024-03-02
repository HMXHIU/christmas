import * as anchor from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Connection, Keypair } from "@solana/web3.js";
import { AnchorClient } from "../app/src/lib/anchorClient";
import { COUNTRY_DETAILS } from "../app/src/lib/userDeviceClient/defs";
import { stringToUint8Array } from "../app/src/lib/utils";

export async function requestAirdrop(
    publicKeys: anchor.web3.PublicKey[],
    amount: number,
    connection: Connection
) {
    // Airdrop in parallel
    await Promise.all(
        publicKeys.map((publicKey) => {
            return new Promise<void>(async (resolve) => {
                const sig = await connection.requestAirdrop(publicKey, amount);
                const blockHash = await connection.getLatestBlockhash();
                await connection.confirmTransaction({
                    blockhash: blockHash.blockhash,
                    lastValidBlockHeight: blockHash.lastValidBlockHeight,
                    signature: sig,
                });
                resolve();
            });
        })
    );
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
        Math.random() * Object.values(COUNTRY_DETAILS).length
    );
    const regionCode = Object.values(COUNTRY_DETAILS)[regionIdx][0];
    return Array.from(stringToUint8Array(regionCode));
}

export function getRandomAnchorClient(): [Keypair, AnchorClient] {
    const kp = Keypair.generate();
    let anchorClient = new AnchorClient({
        keypair: kp,
        wallet: new NodeWallet(kp),
    });
    return [kp, anchorClient];
}
