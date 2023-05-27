import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { ChristmasWeb3 } from "../target/types/christmas_web3";
import { assert } from "chai";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  mintTo,
  createMint,
  createAssociatedTokenAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("christmas-web3", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();
  const program = anchor.workspace.ChristmasWeb3 as Program<ChristmasWeb3>;
  const userAccount = anchor.web3.Keypair.generate();
  const userAccount2 = anchor.web3.Keypair.generate(); // has no lamports

  // generate the mint keypair - because a mint is unique (it can only create 1 type of tokens)
  const mintAccount = anchor.web3.Keypair.generate();

  // generate the usdc keypair - This replicates the USDC 
  const usdcAccount = anchor.web3.Keypair.generate();

  it("Airdrop to user", async () => {
    // usdc
    await provider.connection.requestAirdrop(usdcAccount.publicKey, 100e9);

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

  /*
   *  addToPool
   */
  it("Add to pool", async () => {

    let signer = new Keypair();
    let usdc_token = await createMint(
      program.provider.connection,
      usdcAccount,
      usdcAccount.publicKey,
      null,
      6
    );
    console.log("USDC Token", usdc_token)

    // calculate the PDA of the user account
    const [user_pda, user_bump] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), userAccount.publicKey.toBuffer()],
      program.programId
    );

    // generate user's ATA key to hold the USDC's tokens
    const user_usdc_account = await createAssociatedTokenAccount(
      program.provider.connection,
      userAccount,
      usdc_token,
      userAccount.publicKey
    );

    // mint some USDC to user ata
    await mintTo(
      program.provider.connection,
      userAccount,
      usdc_token,
      user_usdc_account,
      usdcAccount,
      LAMPORTS_PER_SOL / 100  // 10 token
    );
    console.log("User's USDC account", user_usdc_account)

    // PDA account belongs to program
    const [christmas_pda, christmas_pda_bump] =
      web3.PublicKey.findProgramAddressSync(
        [Buffer.from("christmas_account")],
        program.programId
      );
    console.log("Christmas's PDA account", christmas_pda)

    // generate program's ATA key to hold the USDC's tokens
    const christmas_usdc_account = await getAssociatedTokenAddress(
      usdc_token,
      christmas_pda,
      true
    );

    console.log("Christmas's USDC account", christmas_usdc_account)

    // check if account exist, need to keep this as reference for comparision after transfer
    const user_pda_acc = await program.provider.connection.getAccountInfo(user_pda);
    let user_pda_info = null;
    if (user_pda_acc) {
      user_pda_info = await program.account.userAccount.fetch(user_pda);
    }

    const christmas_pda_acc = await program.provider.connection.getAccountInfo(christmas_pda);
    let christmas_pda_info = null;
    if (christmas_pda_acc) {
      christmas_pda_info = await program.account.christmasAccount.fetch(christmas_pda);
    }

    const tx = await program.methods
      .addToPool(new anchor.BN(1000000)) // 1 token
      .accounts({
        userAccount: user_pda, // this is the PDA we will make for the user to associate him to our program
        userUsdcAccount: user_usdc_account,
        christmasAccount: christmas_pda,
        christmasUsdcAccount: christmas_usdc_account,
        mint: usdc_token,
        signer: userAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([userAccount])
      .rpc();
    console.log("================================================")
    console.log("User Account (pubKey):", userAccount.publicKey.toString());
    console.log("User Account (secret):", userAccount.secretKey.toString());
    console.log("Your transaction signature", tx);
    console.log("================================================")

    // check owner is program
    const pdaInfo = await program.provider.connection.getAccountInfo(user_pda);
    assert.ok(pdaInfo.owner.equals(program.programId));

    // check totalAmountContributed
    const user_pda_info_2 = await program.account.userAccount.fetch(user_pda);
    if (user_pda_info) {
      const userContributionBefore = Number(user_pda_info.totalAmountContributed)
      const userContributionAfter = Number(user_pda_info_2.totalAmountContributed)
      assert.ok(userContributionAfter - userContributionBefore === 1000000);
    } else {
      const userContribution = Number(user_pda_info_2.totalAmountContributed)
      assert.ok(userContribution === 1000000);
    }

    const pdaPoolInfo = await program.provider.connection.getAccountInfo(
      christmas_pda
    );
    assert.ok(pdaPoolInfo.owner.equals(program.programId));

    // check totalAmountContributed
    const christmas_pda_info_2 = await program.account.christmasAccount.fetch(
      christmas_pda
    );

    if (christmas_pda_info) {
      const contributionBefore = Number(christmas_pda_info.totalAmountContributed)
      const contributionAfter = Number(christmas_pda_info_2.totalAmountContributed)
      assert.ok(contributionAfter - contributionBefore === 1000000);
    } else {
      const contribution = Number(christmas_pda_info_2.totalAmountContributed)
      assert.ok(contribution === 1000000);
    }
  });

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
    const description = "A free coke";
    const num_tokens = 100;
    const tx = await program.methods
      .mintTokenToMarketplace("A free coke", new anchor.BN(num_tokens), bump)
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
    assert.ok(pda.description === description);

    // check token value of `marketplaceTokenPdaAta`
    const value = (
      await provider.connection.getParsedAccountInfo(marketplaceTokenPdaAta)
    ).value["data"]["parsed"]["info"]["tokenAmount"]["amount"];
    assert.ok(Number(value) === num_tokens);
  });

  it("List marketplace tokens", async () => {
    const accounts = await provider.connection.getParsedProgramAccounts(
      program.programId,
      {
        filters: [
          {
            dataSize: 127, // number of bytes for MarketPlaceTokenPDA
          },
        ],
      }
    );

    console.log(`Found ${accounts.length} MarketPlaceTokenPDA accounts:`);

    accounts.forEach((account, i) => {
      console.log(
        `-- Token Account Address ${i + 1}: ${account.pubkey.toString()} --`
      );
      console.log(account.account.data);
    });

    // const allMarketTokenPdas = (
    //   await program.account.marketPlaceTokenPda.all()
    // ).forEach((pda) => {
    //   console.log("    ", pda);
    // });
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
