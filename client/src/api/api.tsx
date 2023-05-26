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
    MINT_SIZE,
    getAssociatedTokenAddress
} from "@solana/spl-token";

export const ListAccounts = (wallet: AnchorWallet) => {
    // const cluster = web3.clusterApiUrl('devnet');
    const cluster = "http://localhost:8899";
    const connection = new web3.Connection(cluster, 'confirmed')
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
    // const cluster = web3.clusterApiUrl('devnet');
    const cluster = "http://localhost:8899";
    const connection = new web3.Connection(cluster, 'confirmed')
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
        .signers([mintAccount])
        .instruction()
    
    const tx = new Transaction();
    tx.add(mintTokenToMarketplaceIx);

    signAndSendTx(
        connection,
        tx,
        wallet
    )

}
