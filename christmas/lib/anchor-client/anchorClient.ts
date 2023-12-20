import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Transaction, Signer } from "@solana/web3.js";
import idl from "../../target/idl/christmas.json";
import { Christmas } from "../../target/types/christmas";
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import { DISCRIMINATOR_SIZE, PUBKEY_SIZE } from "./def";
import { getCountry, getGeohash } from "../user-device-client/utils"; // TODO: move this to a library
import { Wallet, AnchorWallet } from "@solana/wallet-adapter-react";

import {
    Account,
    TransactionResult,
    User,
    Coupon,
    Store,
    TokenAccount,
} from "./types";

declare global {
    interface Window {
        solana: any; // turn off type checking
    }
}

export class AnchorClient {
    programId: web3.PublicKey;
    cluster: string;
    connection: web3.Connection;
    provider: anchor.Provider;
    program: anchor.Program<Christmas>;
    anchorWallet: AnchorWallet; // AnchorWallet from useAnchorWallet() to set up Anchor in the frontend
    wallet: Wallet; // The Wallet from useWallet has more functionality, but can't be used to set up the AnchorProvider

    constructor({
        programId,
        cluster,
        anchorWallet,
        wallet,
    }: {
        anchorWallet: AnchorWallet;
        wallet: Wallet;
        programId?: web3.PublicKey;
        cluster?: string;
    }) {
        this.anchorWallet = anchorWallet;
        this.wallet = wallet;
        this.programId =
            programId || new web3.PublicKey(anchor.workspace.programId);
        this.cluster = cluster || "http://127.0.0.1:8899";
        this.connection = new web3.Connection(this.cluster, "confirmed");

        console.log(
            `Connected to cluster: ${this.cluster} program: ${this.programId}`
        );

        this.provider = new anchor.AnchorProvider(
            this.connection,
            this.anchorWallet,
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
    ): Promise<TransactionResult> {
        const bh = await this.connection.getLatestBlockhash();
        const result = (
            await this.connection.confirmTransaction(
                {
                    blockhash: bh.blockhash,
                    lastValidBlockHeight: bh.lastValidBlockHeight,
                    signature: signature,
                },
                commitment
            )
        ).value;

        console.log(`Transaction: ${signature} Result: ${result}`);

        return { result, signature };
    }

    async executeTransaction(
        tx: Transaction,
        signers?: Array<Signer>
    ): Promise<TransactionResult> {
        // set latest blockhash
        tx.recentBlockhash = (
            await this.connection.getLatestBlockhash("confirmed")
        ).blockhash;

        // set payer
        tx.feePayer = this.anchorWallet.publicKey;

        // additional signers if required
        if (signers) {
            tx.partialSign(...signers);
        }

        // sign and send
        const signature = await this.connection.sendRawTransaction(
            (await this.anchorWallet.signTransaction(tx)).serialize()
        );

        // confirm transaction
        return await this.confirmTransaction(signature);
    }

    async requestAirdrop(amount: number): Promise<TransactionResult> {
        const signature = await this.connection.requestAirdrop(
            this.anchorWallet.publicKey,
            amount
        );
        // confirm transaction
        return await this.confirmTransaction(signature);
    }

    getUserPda(wallet?: web3.PublicKey): [web3.PublicKey, number] {
        return web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("user"),
                wallet
                    ? wallet.toBuffer()
                    : this.anchorWallet.publicKey.toBuffer(),
            ],
            this.program.programId
        );
    }

    async getUserTokenAccount(
        mint: web3.PublicKey,
        wallet?: web3.PublicKey
    ): Promise<web3.PublicKey> {
        const userPda = this.getUserPda(wallet)[0];

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
    }): Promise<TransactionResult> {
        const [pda, _] = this.getUserPda();

        const ix = await this.program.methods
            .createUser(region, geo)
            .accounts({
                user: pda,
                signer: this.anchorWallet.publicKey,
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
        mint,
    }: {
        geo: string;
        region: string;
        name: string;
        uri: string;
        symbol: string;
        mint?: web3.Keypair;
    }): Promise<TransactionResult> {
        // generate new mint keys if not provided
        if (mint === undefined) {
            mint = web3.Keypair.generate();
        }

        // calculate region market accounts
        const [regionMarketPda, regionMarketTokenAccountPda] =
            await this.getRegionMarketPdasFromMint(mint.publicKey, region);

        // calculate couponPda
        const [couponPda, _] = this.getCouponPda(mint.publicKey);

        // create coupon
        const ix = await this.program.methods
            .createCoupon(name, symbol, region, geo, uri)
            .accounts({
                mint: mint.publicKey,
                coupon: couponPda,
                signer: this.anchorWallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                regionMarket: regionMarketPda,
                regionMarketTokenAccount: regionMarketTokenAccountPda,
            })
            .instruction();
        const tx = new Transaction();
        tx.add(ix);
        return await this.executeTransaction(tx, [mint]);
    }

    /**
     * Issuer redeems a coupon for a specified mint from a user, essentially burning the user's token.
     * @param params - Parameters for the coupon redemption.
     * @param params.coupon - The coupon's public key.
     * @param params.mint - The mint associated with the coupon and tokens.
     * @param params.wallet - The public key of the wallet to redeem from.
     * @param params.numTokens - The number of tokens to redeem (defaults to 1).
     * @returns A promise resolving to a SignatureResult indicating the redemption's outcome.
     */
    async redeemCoupon({
        coupon,
        mint,
        numTokens = 1,
    }: {
        coupon: web3.PublicKey;
        mint: web3.PublicKey;
        numTokens: number;
    }): Promise<TransactionResult> {
        // Calculate the Program Derived Address (PDA) for the user.
        const userPda = this.getUserPda()[0];

        // Get the associated token account owned by the userPda.
        const userTokenAccount = await getAssociatedTokenAddress(
            mint,
            userPda,
            true // Allow the owner account to be a PDA (Program Derived Address).
        );

        // Construct the instruction for the redeemCoupon transaction.
        const ix = await this.program.methods
            .redeemCoupon(new anchor.BN(numTokens))
            .accounts({
                coupon: coupon,
                mint: mint,
                user: userPda,
                userTokenAccount: userTokenAccount,
                signer: this.anchorWallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .instruction();

        // Build and execute the transaction.
        const tx = new Transaction();
        tx.add(ix);
        return await this.executeTransaction(tx);
    }

    // TODO: write tests for each invalid case
    async verifyRedemption({
        signature,
        wallet,
        mint,
        numTokens,
    }: {
        signature: web3.TransactionSignature;
        mint: web3.PublicKey;
        wallet: web3.PublicKey;
        numTokens: number;
    }): Promise<{ isVerified: boolean; err: string }> {
        try {
            // retrieve transaction
            const tx = await this.connection.getTransaction(signature, {
                maxSupportedTransactionVersion: 0,
                commitment: "confirmed",
            });

            // check if transaction was confirmed
            if (!tx || !tx.blockTime) {
                return {
                    isVerified: false,
                    err: "Redemption has not been confirmed",
                };
            }

            const preTokenAccountBalance = tx?.meta?.preTokenBalances?.filter(
                (x) => x.mint === mint.toString()
            )[0];

            const postTokenAccountBalance = tx?.meta?.postTokenBalances?.filter(
                (x) => x.mint === mint.toString()
            )[0];

            // check token account exists
            if (!preTokenAccountBalance || !postTokenAccountBalance) {
                return {
                    isVerified: false,
                    err: "Invalid token accounts",
                };
            }

            // check token account is from user
            const userPda = this.getUserPda(wallet)[0];
            if (
                preTokenAccountBalance.owner !== userPda.toString() ||
                preTokenAccountBalance.owner !== postTokenAccountBalance.owner
            ) {
                return {
                    isVerified: false,
                    err: "Redemption does not belong to user",
                };
            }

            // check mint of transaction is correct
            if (
                !(
                    postTokenAccountBalance.mint ===
                        preTokenAccountBalance.mint &&
                    preTokenAccountBalance.mint === mint.toString()
                )
            ) {
                return {
                    isVerified: false,
                    err: "Mint does not match transaction",
                };
            }

            // check balance deduction
            const balanceBefore = parseInt(
                preTokenAccountBalance.uiTokenAmount?.amount
            );
            const balanceAfter = parseInt(
                postTokenAccountBalance.uiTokenAmount?.amount
            );
            if (balanceBefore - balanceAfter !== numTokens) {
                return {
                    isVerified: false,
                    err: "Mismatched deduction",
                };
            }

            // check time of transaction is within 10 minutes
            if (new Date().getTime() - tx.blockTime * 1000 > 600000) {
                return {
                    isVerified: false,
                    err: "Transaction took place more than 10 minutes ago",
                };
            }

            return {
                isVerified: true,
                err: "",
            };
        } catch {
            return {
                isVerified: false,
                err: "Invalid Redemption Code",
            };
        }
    }

    async getMintedCoupons(): Promise<[Account<Coupon>, number, number][]> {
        const mintedCoupons = await this.program.account.coupon.all([
            {
                memcmp: {
                    offset: DISCRIMINATOR_SIZE,
                    bytes: this.anchorWallet.publicKey.toBase58(), // update_authority
                },
            },
        ]);

        const couponSupplyBalance = await Promise.allSettled(
            mintedCoupons.map(async (coupon) => {
                try {
                    const supply = (
                        await this.connection.getTokenSupply(
                            coupon.account.mint
                        )
                    ).value.uiAmount;

                    const [_, regionMarketTokenAccountPda] =
                        await this.getRegionMarketPdasFromMint(
                            coupon.account.mint
                        );

                    const balance = (
                        await this.connection.getTokenAccountBalance(
                            regionMarketTokenAccountPda
                        )
                    ).value.uiAmount;

                    return [
                        coupon,
                        supply === null ? 0 : supply,
                        balance === null ? 0 : balance,
                    ];
                } catch (error) {
                    // log and reraise error
                    console.error(
                        `Failed to get supply and balance for ${coupon.publicKey.toString()} due to error: ${error}`
                    );
                    throw error;
                }
            })
        );

        return couponSupplyBalance
            .filter((result) => result.status === "fulfilled")
            .map(
                (x) =>
                    (
                        x as PromiseFulfilledResult<
                            [Account<Coupon>, number, number]
                        >
                    ).value
            );
    }

    async getCoupons(
        region: string
    ): Promise<[Account<Coupon>, TokenAccount][]> {
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
            accountsWithBalance.map(async (tokenAccount) => {
                const mint = (
                    tokenAccount.account.data as web3.ParsedAccountData
                ).parsed.info.mint;

                const xs = await this.program.account.coupon.all([
                    {
                        memcmp: {
                            offset: DISCRIMINATOR_SIZE + PUBKEY_SIZE,
                            bytes: mint,
                        },
                    },
                ]);

                return [xs[0], tokenAccount];
            })
        );
    }

    async getClaimedCoupons(): Promise<[Account<Coupon>, number][]> {
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
        mint: web3.PublicKey,
        region?: string
    ): Promise<[web3.PublicKey, web3.PublicKey]> {
        // this region is not provided, try to get it from the coupon (this requires the coupon to exist)
        if (region === undefined) {
            const couponPda = this.getCouponPda(mint)[0];
            const coupon = await this.program.account.coupon.fetch(couponPda);
            region = coupon.region;
        }
        const regionMarketPda = this.getRegionMarketPda(region)[0];

        // this does not mean the token account has been created
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
    ): Promise<TransactionResult> {
        // the region is the coupon.region of the respective mint
        const [regionMarketPda, regionMarketTokenAccountPda] =
            await this.getRegionMarketPdasFromMint(mint);

        // mint numTokens to region market
        const ix = await this.program.methods
            .mintToMarket(region, new anchor.BN(numTokens))
            .accounts({
                regionMarket: regionMarketPda,
                regionMarketTokenAccount: regionMarketTokenAccountPda,
                mint: mint,
                signer: this.anchorWallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .instruction();

        const tx = new Transaction();
        tx.add(ix);
        return await this.executeTransaction(tx);
    }

    /**
     * Claims a certain number of tokens from the market for a specific mint.
     * @param mint - The public key of the mint for which tokens are being claimed.
     * @param numTokens - The number of tokens to be claimed from the market.
     * @returns A promise that resolves to a SignatureResult indicating the outcome of the claim transaction.
     */
    async claimFromMarket(
        mint: web3.PublicKey,
        numTokens: number,
        region?: string | null,
        geo?: string | null
    ): Promise<TransactionResult> {
        // Get the Program Derived Addresses (PDAs) for the region market and the associated token account.
        const [regionMarketPda, regionMarketTokenAccountPda] =
            await this.getRegionMarketPdasFromMint(mint);

        // Check if a user exists, and create one if not.
        const user = await this.getUser();
        if (user === null) {
            if (!region) {
                region = getCountry().code;
            }
            if (!geo) {
                geo = await getGeohash();
            }
            await this.createUser({ region, geo });
        }

        // Calculate the Program Derived Address (PDA) for the user (User needs to be created already by this point).
        const userPda = this.getUserPda()[0];

        // Calculate the associated token account owned by the userPda (Owned by the userPda not the user).
        const userTokenAccount = await getAssociatedTokenAddress(
            mint,
            userPda, // Use userPda instead of user for the associated token account.
            true // allowOwnerOffCurve - Allow the owner account to be a PDA (Program Derived Address)
        );

        // Calculate the Program Derived Address (PDA) for the coupon.
        let couponPda = this.getCouponPda(mint)[0];

        // Output information about the transaction.
        console.log(
            `signer: ${this.anchorWallet.publicKey} couponPda: ${couponPda} regionMarket: ${regionMarketPda} regionMarketTokenAccountPda: ${regionMarketTokenAccountPda}`
        );

        // Build the instruction for the claimFromMarket transaction.
        const ix = await this.program.methods
            .claimFromMarket(new anchor.BN(numTokens))
            .accounts({
                user: userPda,
                userTokenAccount: userTokenAccount,
                coupon: couponPda,
                regionMarket: regionMarketPda,
                regionMarketTokenAccount: regionMarketTokenAccountPda,
                mint: mint,
                signer: this.anchorWallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .instruction();

        // Create a new transaction, add the instruction, and execute the transaction.
        const tx = new Transaction();
        tx.add(ix);
        return await this.executeTransaction(tx);
    }

    getStorePda(name: string): [web3.PublicKey, number] {
        return web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("store"),
                this.anchorWallet.publicKey.toBuffer(),
                anchor.utils.bytes.utf8.encode(name),
            ],
            this.program.programId
        );
    }

    async createStore(
        name: string,
        uri: string,
        region: string,
        geo: string
    ): Promise<TransactionResult> {
        const [storePda, _] = this.getStorePda(name);

        return await this.executeTransaction(
            new Transaction().add(
                await this.program.methods
                    .createStore(name, region, geo, uri)
                    .accounts({
                        store: storePda,
                        signer: this.anchorWallet.publicKey,
                        systemProgram: web3.SystemProgram.programId,
                    })
                    .instruction()
            )
        );
    }

    async getStore(name: string): Promise<Store> {
        const [storePda, _] = this.getStorePda(name);
        return await this.program.account.store.fetch(storePda);
    }
}
