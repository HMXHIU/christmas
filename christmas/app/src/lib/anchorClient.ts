import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

import { Wallet } from "@coral-xyz/anchor";

import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Transaction, Signer } from "@solana/web3.js";
import idl from "../../../target/idl/christmas.json";
import { Christmas } from "../../../target/types/christmas";
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
    COUPON_NAME_SIZE,
    COUPON_SYMBOL_SIZE,
    COUPON_URI_SIZE,
    DISCRIMINATOR_SIZE,
    PUBKEY_SIZE,
    STRING_PREFIX_SIZE,
} from "./constants";
import { getUserPda, stringToBase58 } from "./utils";
import { Coupon, User } from "@/types";
import { min } from "bn.js";

export default class AnchorClient {
    programId: web3.PublicKey;
    cluster: string;
    connection: anchor.web3.Connection;
    provider: anchor.Provider;
    program: anchor.Program<Christmas>;
    wallet: AnchorWallet | Wallet;

    constructor({
        programId,
        cluster,
        wallet,
    }: {
        programId?: web3.PublicKey;
        cluster?: string;
        wallet?: AnchorWallet | Wallet;
    } = {}) {
        this.programId = programId || new web3.PublicKey(idl.metadata.address);
        this.cluster = cluster || "http://127.0.0.1:8899";
        this.connection = new anchor.web3.Connection(this.cluster, "confirmed");

        console.log(
            `Connected to cluster: ${this.cluster} program: ${this.programId}`
        );

        this.wallet = wallet || new Wallet(anchor.web3.Keypair.generate());

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

    async confirmTransaction(
        signature: string,
        commitment?: web3.Commitment
    ): Promise<web3.SignatureResult> {
        const bh = await this.connection.getLatestBlockhash();
        return (
            await this.connection.confirmTransaction(
                {
                    blockhash: bh.blockhash,
                    lastValidBlockHeight: bh.lastValidBlockHeight,
                    signature: signature,
                },
                commitment
            )
        ).value;
    }

    async executeTransaction(
        tx: Transaction,
        signers?: Array<Signer>
    ): Promise<web3.SignatureResult> {
        // set latest blockhash
        tx.recentBlockhash = (
            await this.connection.getLatestBlockhash("confirmed")
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

    async requestAirdrop(amount: number): Promise<web3.SignatureResult> {
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

    async getUserTokenAccount(mint: web3.PublicKey): Promise<web3.PublicKey> {
        const userPda = this.getUserPda()[0];

        return await getAssociatedTokenAddress(
            mint,
            userPda, // userPda not user
            true // allowOwnerOffCurve - Allow the owner account to be a PDA (Program Derived Address)
        );
    }

    async getUser(): Promise<User | null> {
        const [pda, _] = this.getUserPda();
        try {
            return await this.program.account.user.fetch(pda);
        } catch (error) {
            return null;
        }
    }

    async createUser({
        geo,
        region,
    }: {
        geo: string;
        region: string;
    }): Promise<web3.SignatureResult> {
        const [pda, _] = this.getUserPda();

        const ix = await this.program.methods
            .createUser(region, geo)
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

    getCouponPda(mint: web3.PublicKey): [web3.PublicKey, number] {
        return web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("coupon"), mint.toBuffer()],
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
    }): Promise<[web3.PublicKey, web3.PublicKey]> {
        // generate new mint keys
        const mint = web3.Keypair.generate();

        // calculate couponPda
        const [couponPda, _] = this.getCouponPda(mint.publicKey);

        // create coupon
        const ix = await this.program.methods
            .createCoupon(name, symbol, region, geo, uri)
            .accounts({
                mint: mint.publicKey,
                coupon: couponPda,
                signer: this.wallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .instruction();
        const tx = new Transaction();
        tx.add(ix);
        await this.executeTransaction(tx, [mint]);
        return [mint.publicKey, couponPda];
    }

    async redeemCoupon({
        coupon,
        mint,
        wallet,
        numTokens,
    }: {
        coupon: web3.PublicKey;
        mint: web3.PublicKey;
        wallet: web3.PublicKey;
        numTokens: number;
    }): Promise<web3.SignatureResult> {
        const userPda = getUserPda(wallet, this.programId)[0];
        const userTokenAccount = await getAssociatedTokenAddress(
            mint,
            userPda,
            true
        );

        const ix = await this.program.methods
            .redeemCoupon(new anchor.BN(numTokens))
            .accounts({
                coupon: coupon,
                mint: mint,
                wallet: wallet,
                user: userPda,
                userTokenAccount: userTokenAccount,
                signer: this.wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .instruction();

        const tx = new Transaction();
        tx.add(ix);
        return await this.executeTransaction(tx);
    }

    async getMintedCoupons(): Promise<Coupon[]> {
        return await this.program.account.coupon.all([
            {
                memcmp: {
                    offset: DISCRIMINATOR_SIZE,
                    bytes: this.wallet.publicKey.toBase58(), // update_authority
                },
            },
        ]);
    }

    async getCoupons(region: string): Promise<Coupon[]> {
        // get token accounts owned by
        const regionMarketPda = this.getRegionMarketPda(region)[0];
        const tokenAccounts = await this.connection.getParsedProgramAccounts(
            TOKEN_PROGRAM_ID,
            {
                filters: [
                    {
                        dataSize: 165,
                    },
                    {
                        memcmp: {
                            offset: 32,
                            bytes: regionMarketPda.toBase58(),
                        },
                    },
                ],
            }
        );
        const accountsWithBalance = tokenAccounts.filter(
            (x) =>
                (x.account.data as web3.ParsedAccountData).parsed.info
                    .tokenAmount.uiAmount > 0
        );

        // get coupons for mints in accountsWithBalance
        return await Promise.all(
            accountsWithBalance.map(async (x) => {
                const mint = (x.account.data as web3.ParsedAccountData).parsed
                    .info.mint;

                const xs = await this.program.account.coupon.all([
                    {
                        memcmp: {
                            offset: DISCRIMINATOR_SIZE + PUBKEY_SIZE,
                            bytes: mint,
                        },
                    },
                ]);

                return xs[0];
            })
        );
    }

    async getClaimedCoupons(): Promise<[Coupon, number][]> {
        const userPda = this.getUserPda()[0];

        // get token accounts of userPda
        const tokenAccounts = await this.connection.getParsedProgramAccounts(
            TOKEN_PROGRAM_ID,
            {
                filters: [
                    {
                        dataSize: 165,
                    },
                    {
                        memcmp: {
                            offset: 32,
                            bytes: userPda.toBase58(),
                        },
                    },
                ],
            }
        );

        // get (mints, balance)'s with at least 1 token
        const mintsBalance = tokenAccounts
            .filter(
                (x) =>
                    (x.account.data as web3.ParsedAccountData).parsed.info
                        .tokenAmount.uiAmount > 0
            )
            .map((x) => [
                (x.account.data as web3.ParsedAccountData).parsed.info.mint,
                (x.account.data as web3.ParsedAccountData).parsed.info
                    .tokenAmount.uiAmount,
            ]);

        // get (coupon, balance)
        return await Promise.all(
            mintsBalance.map(async ([mint, balance]) => {
                const coupons = await this.program.account.coupon.all([
                    {
                        memcmp: {
                            offset: DISCRIMINATOR_SIZE + PUBKEY_SIZE, // mint
                            bytes: mint,
                        },
                    },
                ]);
                return [coupons[0], balance];
            })
        );
    }

    async getRegionMarketPdasFromMint(
        mint: web3.PublicKey
    ): Promise<[web3.PublicKey, web3.PublicKey]> {
        const couponPda = this.getCouponPda(mint)[0];
        const coupon = await this.program.account.coupon.fetch(couponPda);
        const couponRegion = coupon.region;
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
    ): Promise<web3.SignatureResult> {
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

    async claimFromMarket(
        mint: web3.PublicKey,
        numTokens: number
    ): Promise<web3.SignatureResult> {
        const [regionMarketPda, regionMarketTokenAccountPda] =
            await this.getRegionMarketPdasFromMint(mint);

        // create user if needed (TODO: make 1 single transaction)
        const user = await this.getUser();
        if (user === null) {
            const region = "SGP"; // TODO: get dynamically
            const geo = "w21zc9"; // TODO: get dynamically
            await this.createUser({ region, geo });
        }

        // calculate userPda (Note: A user needs to be created already by this point)
        const userPda = this.getUserPda()[0];

        // calculate userTokenAccount (this is owned by the userPda not the user)
        const userTokenAccount = await getAssociatedTokenAddress(
            mint,
            userPda, // userPda not user
            true // allowOwnerOffCurve - Allow the owner account to be a PDA (Program Derived Address)
        );

        // calculate couponPda
        let couponPda = this.getCouponPda(mint)[0];

        console.log(
            `signer: ${this.wallet.publicKey} couponPda: ${couponPda} regionMarket: ${regionMarketPda} regionMarketTokenAccountPda: ${regionMarketTokenAccountPda}`
        );

        const ix = await this.program.methods
            .claimFromMarket(new anchor.BN(numTokens))
            .accounts({
                user: userPda,
                userTokenAccount: userTokenAccount,
                coupon: couponPda,
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
