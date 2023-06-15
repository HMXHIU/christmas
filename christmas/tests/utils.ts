import * as anchor from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";
import { web3 } from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";

export function stringToUint8Array(input: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(input);
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
        const sig = await provider.connection.requestAirdrop(publicKey, amount);
        const blockHash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
          blockhash: blockHash.blockhash,
          lastValidBlockHeight: blockHash.lastValidBlockHeight,
          signature: sig,
        });
        console.log(`Airdrop ${amount} to ${publicKey}`);
        resolve();
      });
    })
  );
}

export const DISCRIMINATOR_SIZE = 8;
export const PUBKEY_SIZE = 32;
export const U8_SIZE = 1;
export const U64_SIZE = 8;
export const BOOL_SIZE = 1;
export const STRING_PREFIX_SIZE = 4;
export const BUMP_SIZE = 1;
export const GEO_SIZE = STRING_PREFIX_SIZE + 6; // 6 characters of resolution
export const TWO_FACTOR_SIZE = U8_SIZE * 32; // 256 bit
export const REGION_SIZE = STRING_PREFIX_SIZE + 3; // 3 digit country code
export const COUPON_NAME_SIZE = 36;
export const COUPON_SYMBOL_SIZE = 14;
export const COUPON_URI_SIZE = 204;

export const USER_ACCOUNT_SIZE =
  DISCRIMINATOR_SIZE + TWO_FACTOR_SIZE + REGION_SIZE + GEO_SIZE + BUMP_SIZE;
