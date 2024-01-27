import * as anchor from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";

export async function requestAirdrop(
    publicKeys: anchor.web3.PublicKey[],
    amount: number
) {
    const provider = anchor.getProvider();

    // Airdrop in parallel
    await Promise.all(
        publicKeys.map((publicKey) => {
            return new Promise<void>(async (resolve) => {
                const sig = await provider.connection.requestAirdrop(
                    publicKey,
                    amount
                );
                const blockHash =
                    await provider.connection.getLatestBlockhash();
                await provider.connection.confirmTransaction({
                    blockhash: blockHash.blockhash,
                    lastValidBlockHeight: blockHash.lastValidBlockHeight,
                    signature: sig,
                });
                resolve();
            });
        })
    );
}

export async function createUser(
    wallet: anchor.web3.Keypair,
    region: number[],
    geohash: number[]
): Promise<[anchor.web3.PublicKey, number]> {
    const program = anchor.workspace.Christmas as anchor.Program<Christmas>;

    // Calculate the PDA of the user
    const [pda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from(anchor.utils.bytes.utf8.encode("user")),
            wallet.publicKey.toBuffer(),
        ],
        program.programId
    );

    // Create user
    const tx = await program.methods
        .createUser(region)
        .accounts({
            user: pda,
            signer: wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();

    return [pda, bump];
}

export function getRandomDate(startYear: number, endYear: number): Date {
    const year =
        Math.floor(Math.random() * (endYear - startYear + 1)) + startYear;
    const month = Math.floor(Math.random() * 12);
    const day = Math.floor(Math.random() * 28) + 1; // To ensure valid date for all months
    return new Date(Date.UTC(year, month, day));
}
