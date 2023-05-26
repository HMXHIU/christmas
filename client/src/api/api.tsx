import idl from "./christmas_web3.json"
import { ChristmasProgram } from "./christmas_web3";
import * as web3 from "@solana/web3.js"
import * as anchor from '@project-serum/anchor'; // includes https://solana-labs.github.io/solana-web3.js/
import { AnchorWallet } from "@solana/wallet-adapter-react";



const { SystemProgram } = anchor.web3; // Added to initialize account



const preflightCommitment = 'processed'
const commitment = 'processed'
const programID = new web3.PublicKey(idl.metadata.address)



export const ListAccounts = (wallet: AnchorWallet) => {
    // const cluster = web3.clusterApiUrl('devnet');
    const cluster = "http://localhost:8899";
    const connection = new web3.Connection(cluster, 'confirmed')
    const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions())
    const program = new anchor.Program<ChristmasProgram>(idl as any, idl.metadata.address, provider)

    console.log(`cluster: ${cluster}`)
    console.log(`ProgramId: ${program.programId}`)


    console.log("SAYING HELLO")
    program.methods.sayHello();

    
    


}