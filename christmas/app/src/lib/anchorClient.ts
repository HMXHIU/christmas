import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { Transaction, Signer } from "@solana/web3.js";
import idl from "../../../target/idl/christmas.json";
import { Christmas } from "../../../target/types/christmas";
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import { DISCRIMINATOR_SIZE } from "./constants";
import { BN } from "bn.js";

export default class AnchorClient {
    programId: web3.PublicKey;
    cluster: string;
    connection: anchor.web3.Connection;
    provider: anchor.Provider;
    program: anchor.Program<Christmas>;
    wallet: anchor.Wallet | PhantomWalletAdapter;

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
        this.cluster = cluster || "http://127.0.0.1:8899";
        this.connection = new anchor.web3.Connection(this.cluster, "confirmed");

        console.log(`Connected to ${cluster}`);

        this.wallet =
            typeof window !== "undefined" &&
            window.solana?.isConnected &&
            window.solana?.isPhantom
                ? new PhantomWalletAdapter()
                : keypair
                ? new anchor.Wallet(keypair)
                : new anchor.Wallet(anchor.web3.Keypair.generate());

        this.provider = new anchor.AnchorProvider(
            this.connection,
            this.wallet,
            anchor.AnchorProvider.defaultOptions()
        );
        this.program = new anchor.Program<Christmas>(
            idl as any,
            this.programId,
            this.provider
        );
    }

    async confirmTransaction(signature: string): Promise<string> {
        const bh = await this.connection.getLatestBlockhash();
        await this.connection.confirmTransaction({
            blockhash: bh.blockhash,
            lastValidBlockHeight: bh.lastValidBlockHeight,
            signature: signature,
        });

        // TODO: Error handling, return web3.SignatureResult instead
        return signature;
    }

    async executeTransaction(
        tx: Transaction,
        signers?: Array<Signer>
    ): Promise<string> {
        // set latest blockhash
        tx.recentBlockhash = (
            await this.connection.getLatestBlockhash("singleGossip")
        ).blockhash;

        // set payer
        tx.feePayer = this.wallet.publicKey;

        // additional signers if required
        if (signers) {
            tx.partialSign(...signers);
        }

        // sign and send
        const sig = await this.connection.sendRawTransaction(
            (await this.wallet.signTransaction(tx)).serialize()
        );

        // confirm transaction
        return await this.confirmTransaction(sig);
    }

    async requestAirdrop(amount: number): Promise<string> {
        const sig = await this.connection.requestAirdrop(
            this.wallet.publicKey,
            amount
        );
        return await this.confirmTransaction(sig);
    }

    getUserPda(): [web3.PublicKey, number] {
        return web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("user"),
                this.wallet.publicKey.toBuffer(),
            ],
            this.program.programId
        );
    }

    async createUser({
        email,
        geo,
        region,
    }: {
        email: string;
        geo: string;
        region: string;
    }): Promise<string> {
        const [pda, _] = this.getUserPda();

        const ix = await this.program.methods
            .createUser(email, region, geo)
            .accounts({
                user: pda,
                signer: this.wallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .instruction();

        const tx = new Transaction();
        tx.add(ix);

        return await this.executeTransaction(tx);
    }

    getCouponMetadataPda(mint: web3.PublicKey): [web3.PublicKey, number] {
        return web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("metadata"), mint.toBuffer()],
            this.program.programId
        );
    }

    getRegionMarketPda(region: string): [web3.PublicKey, number] {
        return web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("market"),
                anchor.utils.bytes.utf8.encode(region),
            ],
            this.program.programId
        );
    }

    async createCoupon({
        geo,
        region,
        name,
        uri,
        symbol,
    }: {
        geo: string;
        region: string;
        name: string;
        uri: string;
        symbol: string;
    }): Promise<string> {
        // generate new mint keys
        const mint = web3.Keypair.generate();

        // calculate couponMetadataPda
        const [couponMetadataPda, _] = this.getCouponMetadataPda(
            mint.publicKey
        );

        // create coupon (mint + metadata)
        const ix = await this.program.methods
            .createCouponMint(name, symbol, region, geo, uri)
            .accounts({
                mint: mint.publicKey,
                metadata: couponMetadataPda,
                signer: this.wallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .instruction();
        const tx = new Transaction();
        tx.add(ix);
        return await this.executeTransaction(tx, [mint]);
    }

    async getMintedCoupons() {
        const coupons = await this.program.account.couponMetadata.all([
            {
                memcmp: {
                    offset: DISCRIMINATOR_SIZE,
                    bytes: this.wallet.publicKey.toBase58(),
                },
            },
        ]);
        return coupons.map((x) => x.account);
    }

    async getRegionMarketPdasFromMint(
        mint: web3.PublicKey
    ): Promise<[web3.PublicKey, web3.PublicKey]> {
        const couponMetadataPda = this.getCouponMetadataPda(mint)[0];

        const couponMetadata = await this.program.account.couponMetadata.fetch(
            couponMetadataPda
        );

        const couponRegion = couponMetadata.region;
        const regionMarketPda = this.getRegionMarketPda(couponRegion)[0];

        const regionMarketTokenAccountPda = await getAssociatedTokenAddress(
            mint,
            regionMarketPda,
            true // allowOwnerOffCurve - Allow the owner account to be a PDA (Program Derived Address)
        );

        return [regionMarketPda, regionMarketTokenAccountPda];
    }

    async mintToMarket(
        mint: web3.PublicKey,
        region: string,
        numTokens: number
    ): Promise<string> {
        const [regionMarketPda, regionMarketTokenAccountPda] =
            await this.getRegionMarketPdasFromMint(mint);

        // mint numTokens to region market
        const ix = await this.program.methods
            .mintToMarket(region, new anchor.BN(numTokens))
            .accounts({
                regionMarket: regionMarketPda,
                regionMarketTokenAccount: regionMarketTokenAccountPda,
                mint: mint,
                signer: this.wallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .instruction();

        const tx = new Transaction();
        tx.add(ix);
        return await this.executeTransaction(tx);
    }
}
