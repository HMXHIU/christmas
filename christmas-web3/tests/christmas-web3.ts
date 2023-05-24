import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { ChristmasWeb3 } from "../target/types/christmas_web3";
import { assert } from "chai";
import {
  TOKEN_PROGRAM_ID,
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

  it("Airdrop to user", async () => {
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
  it("Hello", async () => {
    const tx = await program.methods.sayHello().rpc();
  });

  /*
   *  addToPool
   */
  it("Add to pool", async () => {
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

  /*
    mintToken
  */
  it("Mint token", async () => {
    // min rent for creating a mint
    const mint_rent_lamports =
      await program.provider.connection.getMinimumBalanceForRentExemption(
        MINT_SIZE
      );

    // generate the mint keypair - because a mint is unique (it can only create 1 type of tokens)
    const mintKey = anchor.web3.Keypair.generate();

    // generate user's ATA key to hold the mint's tokens
    const associated_token_account = await getAssociatedTokenAddress(
      mintKey.publicKey,
      userAccount.publicKey
    );

    const mint_tx = new anchor.web3.Transaction().add(
      // create the mint account
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: userAccount.publicKey,
        newAccountPubkey: mintKey.publicKey,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports: mint_rent_lamports,
      }),
      // initialize mint account properties
      createInitializeMintInstruction(
        mintKey.publicKey, // mint
        0, // decimals
        userAccount.publicKey, // mintAuthority
        userAccount.publicKey // freezeAuthority
      ),
      createAssociatedTokenAccountInstruction(
        userAccount.publicKey, // payer
        associated_token_account, // ata
        userAccount.publicKey, // owner
        mintKey.publicKey // mint
      )
    );

    const res = await provider.sendAndConfirm(
      mint_tx,
      [mintKey] // signers
    );

    console.log(
      await provider.connection.getParsedAccountInfo(mintKey.publicKey)
    );

    const tx = await program.methods
      .mintToken(new anchor.BN(100))
      .accounts({
        signer: userAccount.publicKey,
        mintAccount: mintKey.publicKey,
        tokenAccount: associated_token_account,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userAccount])
      .rpc();

    const minted = (
      await provider.connection.getParsedAccountInfo(associated_token_account)
    ).value;

    assert.ok(Number(minted) === 100);
  });
});
