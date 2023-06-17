import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
const { SystemProgram } = anchor.web3;
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";

import idl from "../../../target/idl/christmas.json";
import { Christmas } from "../../../target/types/christmas";

export default class AnchorClient {
    programId: web3.PublicKey;
    cluster: string;
    connection: anchor.web3.Connection;
    provider: anchor.Provider;
    program: anchor.Program<Christmas>;

    constructor({
        programId,
        cluster,
        keypair,
    }: {
        programId?: web3.PublicKey;
        cluster?: string;
        keypair?: web3.Keypair;
    } = {}) {
        this.programId = programId || new web3.PublicKey(idl.metadata.address);
        this.cluster = cluster || "http://localhost:8899";
        this.connection = new anchor.web3.Connection(this.cluster, "confirmed");

        console.log(`Connected to ${cluster}`);

        const wallet =
            typeof window !== "undefined" &&
            window.solana?.isConnected &&
            window.solana?.isPhantom
                ? new PhantomWalletAdapter()
                : keypair
                ? new anchor.Wallet(keypair)
                : new anchor.Wallet(anchor.web3.Keypair.generate());

        this.provider = new anchor.AnchorProvider(
            this.connection,
            wallet,
            anchor.AnchorProvider.defaultOptions()
        );
        this.program = new anchor.Program<Christmas>(
            idl as any,
            this.programId,
            this.provider
        );
    }
}
