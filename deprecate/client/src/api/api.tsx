import idl from "./christmas_web3.json"
import { ChristmasWeb3 } from "./christmas_web3";
import * as web3 from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { signAndSendTx } from "../utils/utils";

import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress
} from "@solana/spl-token";
import { TokenAccount } from "../view/pool";

// const cluster = web3.clusterApiUrl('devnet');
const cluster = "http://localhost:8899";
const connection = new web3.Connection(cluster, 'confirmed')

export const GetTokenAccounts = (wallet: AnchorWallet) =>
    connection.getParsedProgramAccounts(
        TOKEN_PROGRAM_ID,
        {
            filters: [
                {
                    dataSize: 165, //  For token accounts, this is a known quantity, 165.
                }, {
                    memcmp: {
                        offset: 32,     //location of our query in the account (bytes)
                        bytes: wallet.publicKey.toString(),  //our search criteria, a base58 encoded string
                    }
                }
            ],
        }
    );

export const GetPoolPDAInfo = (wallet: AnchorWallet) => {
    const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program<ChristmasWeb3>(idl as any, idl.metadata.address, provider)

    // PDA account belongs to program
    // eslint-disable-next-line @typescript-eslint/no-unused-vars 
    const [christmas_pda, christmas_pda_bump] =
        web3.PublicKey.findProgramAddressSync(
            [Buffer.from("christmas_account")],
            program.programId
        );

    return program.account.christmasAccount.fetch(christmas_pda);
}

export const GetPDAInfo = (wallet: AnchorWallet) => {
    const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program<ChristmasWeb3>(idl as any, idl.metadata.address, provider)

    // calculate the PDA of the user account
    // eslint-disable-next-line @typescript-eslint/no-unused-vars 
    const [user_pda, user_bump] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_account"), wallet.publicKey.toBuffer()],
        program.programId
    );

    return program.account.userAccount.fetch(user_pda);
}

export const AddToPool = async (wallet: AnchorWallet, tokenAccount: TokenAccount, contribute: number) => {
    const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program<ChristmasWeb3>(idl as any, idl.metadata.address, provider)

    const mint: web3.PublicKey = new web3.PublicKey(tokenAccount.mint);
    const token_account: web3.PublicKey = tokenAccount.pubKey;

    // calculate the PDA of the user account
    // eslint-disable-next-line @typescript-eslint/no-unused-vars 
    const [user_pda, user_bump] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_account"), wallet.publicKey.toBuffer()],
        program.programId
    );

    // PDA account belongs to program
    // eslint-disable-next-line @typescript-eslint/no-unused-vars 
    const [christmas_pda, christmas_pda_bump] =
        web3.PublicKey.findProgramAddressSync(
            [Buffer.from("christmas_account")],
            program.programId
        );

    // generate program's ATA key to hold the USDC's tokens
    const christmas_token_account = await getAssociatedTokenAddress(mint, christmas_pda, true);

    const AddToPoolIx = await program.methods
        .addToPool(new anchor.BN(1000000 * contribute)) // 1000000 == 1 token
        .accounts({
            userAccount: user_pda, // this is the PDA we will make for the user to associate him to our program
            userUsdcAccount: token_account,
            christmasAccount: christmas_pda,
            christmasUsdcAccount: christmas_token_account,
            mint: mint,
            signer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
        })
        .instruction();

    const tx = new Transaction();
    tx.add(AddToPoolIx);

    return await signAndSendTx(
        connection,
        tx,
        wallet,
    )
}

export const ListAccounts = (wallet: AnchorWallet) => {
    const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program<ChristmasWeb3>(idl as any, idl.metadata.address, provider)

    console.log(`cluster: ${cluster}`)
    console.log(`ProgramId: ${program.programId}`)

    return provider.connection.getParsedProgramAccounts(
        program.programId,
        {
            filters: [
                {
                    dataSize: 127, // number of bytes for MarketPlaceTokenPDA
                },
            ],
        }
    )
        .then((accounts) => {
            return Promise.all(accounts.map((acc) => program.account.marketPlaceTokenPda.fetch(acc.pubkey)))
        })
}

export const MintTokenToMarketplace = async (wallet: AnchorWallet, num_tokens: number, description: string) => {
    const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program<ChristmasWeb3>(idl as any, idl.metadata.address, provider)

    console.log(`cluster: ${cluster}`)
    console.log(`ProgramId: ${program.programId}`)

    // generate the mint keypair
    const mintAccount = anchor.web3.Keypair.generate();

    // generate marketplaceTokenPda
    const [marketplaceTokenPda, bump] = web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from(anchor.utils.bytes.utf8.encode("mpt_pda")),
            wallet.publicKey.toBuffer(),
            mintAccount.publicKey.toBuffer(),
        ],
        program.programId
    );

    const marketplaceTokenPdaAta = await getAssociatedTokenAddress(
        mintAccount.publicKey,
        marketplaceTokenPda,
        true // allowOwnerOffCurve - Allow the owner account to be a PDA (Program Derived Address)
    )

    const mintTokenToMarketplaceIx = await program.methods
        .mintTokenToMarketplace(description, new anchor.BN(num_tokens), bump)
        .accounts({
            mintAccount: mintAccount.publicKey,
            tokenAccount: marketplaceTokenPdaAta,
            marketplaceTokenPda: marketplaceTokenPda,
            signer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .instruction()

    const tx = new Transaction();
    tx.add(mintTokenToMarketplaceIx);

    return await signAndSendTx(
        connection,
        tx,
        wallet,
        [mintAccount]
    )

}
