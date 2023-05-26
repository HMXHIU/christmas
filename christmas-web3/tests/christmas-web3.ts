import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { ChristmasWeb3 } from "../target/types/christmas_web3";
import { assert } from "chai";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createInitializeMintInstruction,
} from "@solana/spl-token";

describe("christmas-web3", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();
  const program = anchor.workspace.ChristmasWeb3 as Program<ChristmasWeb3>;
  const userAccount = anchor.web3.Keypair.generate();
  const userAccount2 = anchor.web3.Keypair.generate(); // has no lamports

  // generate the mint keypair - because a mint is unique (it can only create 1 type of tokens)
  const mintAccount = anchor.web3.Keypair.generate();

  it("Airdrop to user", async () => {
    // userAccount
    await provider.connection.requestAirdrop(userAccount.publicKey, 100e9);

    // userAccount2
    const sig = await provider.connection.requestAirdrop(
      userAccount2.publicKey,
      100e9
    );

    const blockHash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      blockhash: blockHash.blockhash,
      lastValidBlockHeight: blockHash.lastValidBlockHeight,
      signature: sig,
    });
  });

  // /*
  //  *  sayHello
  //  */
  // it("Hello", async () => {
  //   const tx = await program.methods.sayHello().rpc();
  // });

  // /*
  //  *  addToPool
  //  */
  // it("Add to pool", async () => {
  //   // calculate the PDA of the user account
  //   const [pda, bump] = web3.PublicKey.findProgramAddressSync(
  //     [Buffer.from("user_account"), userAccount.publicKey.toBuffer()],
  //     program.programId
  //   );

  //   const tx = await program.methods
  //     .addToPool(new anchor.BN(100))
  //     .accounts({
  //       userAccount: pda, // this is the PDA we will make for the user to associate him to our program
  //       signer: userAccount.publicKey,
  //       systemProgram: web3.SystemProgram.programId,
  //     })
  //     .signers([userAccount])
  //     .rpc();
  //   console.log("Your transaction signature", tx);

  //   // check owner is program
  //   const pdaInfo = await program.provider.connection.getAccountInfo(pda);
  //   console.log(pdaInfo.owner, program.programId);
  //   assert.ok(pdaInfo.owner.equals(program.programId));

  //   // check totalAmountContributed
  //   const pdaInfo2 = await program.account.userAccount.fetch(pda);
  //   assert.ok(Number(pdaInfo2.totalAmountContributed) === 100);
  // });

  it("Mint token to marketplace", async () => {
    console.log(`userAccount: ${userAccount.publicKey}`);
    console.log(`mintAccount: ${mintAccount.publicKey}`);

    // generate marketplaceTokenPda
    const [marketplaceTokenPda, bump] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("mpt_pda")),
        userAccount.publicKey.toBuffer(),
        mintAccount.publicKey.toBuffer(),
      ],
      program.programId
    );

    console.log("marketplaceTokenPda: ", marketplaceTokenPda);
    console.log("bump: ", bump);

    // generate marketplaceTokenPda's ATA to hold the tokens
    const marketplaceTokenPdaAta = await getAssociatedTokenAddress(
      mintAccount.publicKey,
      marketplaceTokenPda,
      true // allowOwnerOffCurve - Allow the owner account to be a PDA (Program Derived Address)
    );

    console.log("marketplaceTokenPdaAta: ", marketplaceTokenPdaAta);

    // mint to marketplaceTokenPdaAta
    const tx = await program.methods
      .mintTokenToMarketplace(new anchor.BN(100), bump)
      .accounts({
        mintAccount: mintAccount.publicKey,
        tokenAccount: marketplaceTokenPdaAta,
        marketplaceTokenPda: marketplaceTokenPda,
        signer: userAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([mintAccount, userAccount])
      .rpc();

    const pda = await program.account.marketPlaceTokenPda.fetch(
      marketplaceTokenPda
    );
    console.log(
      `marketPlaceTokenPda[owner=${pda.owner}, bump=${pda.bump}], mint=${pda.mint}`
    );

    // check `marketplaceTokenPda` data set correctly
    assert.ok(pda.owner.equals(userAccount.publicKey));
    assert.ok(pda.bump === bump);
    assert.ok(pda.mint.equals(mintAccount.publicKey));

    // check value
    const value = (
      await provider.connection.getParsedAccountInfo(marketplaceTokenPdaAta)
    ).value["data"]["parsed"]["info"]["tokenAmount"]["amount"];
    assert.ok(Number(value) === 100);
  });

  it("List marketplace tokens", async () => {
    const allMarketTokenPdas = program.account.marketPlaceTokenPda.all();

    console.log("allMarketTokenPdas: ", allMarketTokenPdas);
  });

  // it("Claim token from marketplace", async () => {
  //   /*
  //     userAcccount2 claim from marketplace
  //   */

  //   // generate marketplaceTokenPda's ATA to hold the tokens
  //   const userAccount2TokenAccount = await getAssociatedTokenAddress(
  //     mintAccount.publicKey,
  //     userAccount2.publicKey
  //   );

  //   console.log(`userAccount2: ${userAccount2.publicKey}`);

  //   const tx2 = await program.methods
  //     .claimTokenFromMarket(new anchor.BN(50))
  //     .accounts({
  //       mintAccount: mintAccount.publicKey,
  //       toTokenAccount: userAccount2TokenAccount,
  //       marketplaceTokenPdaAta: marketplaceTokenPdaAta,
  //       marketplaceTokenPda: marketplaceTokenPda,
  //       signer: userAccount2.publicKey,

  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: web3.SystemProgram.programId,
  //       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //     })
  //     .signers([userAccount2])
  //     .rpc();

  //   // check balance
  //   const balance = (
  //     await provider.connection.getParsedAccountInfo(marketplaceTokenPdaAta)
  //   ).value["data"]["parsed"]["info"]["tokenAmount"]["amount"];
  //   assert.ok(Number(balance) === 50);
  // });
});
