import idl from "./christmas_web3.json"
import { ChristmasWeb3 } from "./christmas_web3";
import * as web3 from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";

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