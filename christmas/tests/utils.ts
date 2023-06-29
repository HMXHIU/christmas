import * as anchor from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";
import { web3 } from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";

export function stringToUint8Array(input: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(input);
}

export function getUserPda(user: web3.PublicKey, programId: web3.PublicKey) {
    return web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("user"), user.toBuffer()],
        programId
    );
}

export function getCouponMetadataPda(
    mint: web3.PublicKey,
    programId: web3.PublicKey
): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("metadata"), mint.toBuffer()],
        programId
    );
}

export function getRegionMarketPda(
    region: string,
    programId: web3.PublicKey
): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("market"),
            anchor.utils.bytes.utf8.encode(region),
        ],
        programId
    );
}

export async function createUser(
    wallet: web3.Keypair,
    email: string,
    region: string,
    geo: string
): Promise<[web3.PublicKey, number]> {
    const program = anchor.workspace.Christmas as Program<Christmas>;

    // Calculate the PDA of the user
    const [pda, bump] = web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from(anchor.utils.bytes.utf8.encode("user")),
            wallet.publicKey.toBuffer(),
        ],
        program.programId
    );

    // Create user
    const tx = await program.methods
        .createUser(email, region, geo)
        .accounts({
            user: pda,
            signer: wallet.publicKey,
            systemProgram: web3.SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();

    return [pda, bump];
}

export async function requestAirdrop(
    publicKeys: web3.PublicKey[],
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
