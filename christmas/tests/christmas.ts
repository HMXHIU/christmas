import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Christmas } from "../target/types/christmas";
import { web3 } from "@coral-xyz/anchor";
import { assert } from "chai";

describe("christmas", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();
  const program = anchor.workspace.Christmas as Program<Christmas>;
  const user = anchor.web3.Keypair.generate();

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
    const [pda, bump] = web3.PublicKey.findProgramAddressSync(
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
    let fetched_user = await program.account.user.fetch(pda);

    assert.ok(fetched_user.geo == geo);
    assert.ok(fetched_user.region == region);
  });
});
