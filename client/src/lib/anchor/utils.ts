import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

export function getUserPda(user: web3.PublicKey, programId: web3.PublicKey) {
  return web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("user"), user.toBuffer()],
    programId
  );
}

export function stringToBase58(str: string) {
  const buffer = Buffer.from(str);
  return bs58.encode(buffer);
}

export function stringToUint8Array(input: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(input);
}

export function cleanString(s: string) {
  return s.replace(/\u0000+$/, "");
}
