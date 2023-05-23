import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { ChristmasWeb3 } from "../target/types/christmas_web3";
import { assert } from "chai";

describe("christmas-web3", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();
  const program = anchor.workspace.ChristmasWeb3 as Program<ChristmasWeb3>;
  const userAccount = anchor.web3.Keypair.generate();

  it("Airdrops to user for payer", async () => {
    const airdropSellerSig = await provider.connection.requestAirdrop(
      userAccount.publicKey,
      100e9
    );
    const latestSellerBlockhash =
      await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      blockhash: latestSellerBlockhash.blockhash,
      lastValidBlockHeight: latestSellerBlockhash.lastValidBlockHeight,
      signature: airdropSellerSig,
    });
  });

  /*
   *  sayHello
   */
  it("Hello!", async () => {
    const tx = await program.methods.sayHello().rpc();
  });

  /*
   *  addToPool
   */
  it("Add to pool!", async () => {
    // calculate the PDA of the user account
    const [pda, bump] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), userAccount.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .addToPool(new anchor.BN(100))
      .accounts({
        userAccount: pda, // this is the PDA we will make for the user to associate him to our program
        signer: userAccount.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([userAccount])
      .rpc();
    console.log("Your transaction signature", tx);

    // check owner is program
    const pdaInfo = await program.provider.connection.getAccountInfo(pda);
    console.log(pdaInfo.owner, program.programId);
    assert.ok(pdaInfo.owner.equals(program.programId));

    // check totalAmountContributed
    const pdaInfo2 = await program.account.userAccount.fetch(pda);
    assert.ok(Number(pdaInfo2.totalAmountContributed) === 100);
  });
});
