import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

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
