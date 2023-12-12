import * as anchor from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";
import { web3 } from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";

export function setupAnchor(): [anchor.Provider, Program<Christmas>] {
    anchor.setProvider(anchor.AnchorProvider.env());
    const provider = anchor.getProvider();
    const program = anchor.workspace.Christmas as Program<Christmas>;
    return [provider, program];
}

export function getUserPda(user: web3.PublicKey) {
    const program = anchor.workspace.Christmas as Program<Christmas>;

    return web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("user"), user.toBuffer()],
        program.programId
    );
}

export function getCouponPda(mint: web3.PublicKey): [web3.PublicKey, number] {
    const program = anchor.workspace.Christmas as Program<Christmas>;

    return web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("coupon"), mint.toBuffer()],
        program.programId
    );
}

export function getRegionMarketPda(region: string): [web3.PublicKey, number] {
    const program = anchor.workspace.Christmas as Program<Christmas>;

    return web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("market"),
            anchor.utils.bytes.utf8.encode(region),
        ],
        program.programId
    );
}

export async function createUser(
    wallet: web3.Keypair,
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
        .createUser(region, geo)
        .accounts({
            user: pda,
            signer: wallet.publicKey,
            systemProgram: web3.SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();

    return [pda, bump];
}

export async function createStore(
    wallet: web3.Keypair,
    name: string,
    region: string,
    geo: string,
    uri: string
): Promise<[web3.PublicKey, number]> {
    const program = anchor.workspace.Christmas as Program<Christmas>;

    // Calculate the PDA of the store
    const [pda, bump] = web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from(anchor.utils.bytes.utf8.encode("store")),
            Buffer.from(anchor.utils.bytes.utf8.encode(name)),
            wallet.publicKey.toBuffer(),
        ],
        program.programId
    );

    // Create store
    const tx = await program.methods
        .createStore(name, region, geo, uri)
        .accounts({
            store: pda,
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

export function cleanString(s: string) {
    return s.replace(/\u0000+$/, "");
}
