import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";
import { web3 } from "@coral-xyz/anchor";
import { assert } from "chai";
import { stringToUint8Array } from "./utils";
import { sha256 } from "js-sha256";

describe("christmas", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();
  const program = anchor.workspace.Christmas as Program<Christmas>;
  const user = anchor.web3.Keypair.generate();

  console.log(`program: ${web3.SystemProgram.programId}`);
  console.log(`user: ${user.publicKey}`);

  it("Airdrop to user", async () => {
    const sig = await provider.connection.requestAirdrop(user.publicKey, 100e9);
    const blockHash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      blockhash: blockHash.blockhash,
      lastValidBlockHeight: blockHash.lastValidBlockHeight,
      signature: sig,
    });
  });

  it("Create User", async () => {
    let email = "user@gmail.com";
    let geo = "gbsuv7";
    let region = "SGP";

    // Calculate the PDA of the user
    const [pda, _] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("user")),
        user.publicKey.toBuffer(),
      ],
      program.programId
    );

    console.log(`user pda: ${pda}`);

    // Create user
    const tx = await program.methods
      .createUser(email, region, geo)
      .accounts({
        user: pda,
        signer: user.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Check account is created correctly
    let _user = await program.account.user.fetch(pda);
    assert.ok(_user.geo == geo);
    assert.ok(_user.region == region);
    let twoFactor = sha256.digest([
      ...user.publicKey.toBytes(),
      ...stringToUint8Array(email),
    ]);
    assert.ok(_user.twoFactor == twoFactor);
  });
});
