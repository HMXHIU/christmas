import {
    BN,
    Program,
    Provider,
    AnchorProvider,
    workspace,
    utils,
} from "@coral-xyz/anchor";
import {
    Transaction,
    Signer,
    TransactionInstruction,
    PublicKey,
    Connection,
    ParsedAccountData,
    Keypair,
    SystemProgram,
    SendOptions,
    TransactionSignature,
    Commitment,
} from "@solana/web3.js";
import idl from "../../target/idl/christmas.json";
import { Christmas } from "../../target/types/christmas";
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
    DISCRIMINATOR_SIZE,
    PUBKEY_SIZE,
    U64_SIZE,
    STORE_NAME_SIZE,
    REGION_SIZE,
    GEOHASH_SIZE,
    URI_SIZE,
    STRING_PREFIX_SIZE,
    OFFSET_TO_GEO,
    OFFSET_TO_STORE,
} from "./defs";
import { getCountry, getGeohash } from "../user-device-client/utils";
import { Wallet, AnchorWallet } from "@solana/wallet-adapter-react";

import {
    Account,
    TransactionResult,
    User,
    Coupon,
    Store,
    TokenAccount,
    ProgramState,
} from "./types";
import { timeStampToDate } from "../utils";
import { getDateWithinRangeFilterCombinations, stringToBase58 } from "./utils";
import { Location } from "../user-device-client/types";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

// import "./scratchpad";

export class AnchorClient {
    programId: PublicKey;
    cluster: string;
    connection: Connection;
    provider: Provider;
    program: Program<Christmas>;
    anchorWallet: AnchorWallet; // AnchorWallet from useAnchorWallet() to set up Anchor in the frontend
    wallet: Wallet | null; // The Wallet from useWallet has more functionality, but can't be used to set up the AnchorProvider
    location: Location; // when using AnchorClient not from the broswer, location is required for some functionality

    constructor({
        programId,
        cluster,
        anchorWallet,
        wallet,
        location,
    }: {
        anchorWallet: AnchorWallet;
        wallet?: Wallet;
        programId?: PublicKey;
        cluster?: string;
        location?: Location;
    }) {
        this.anchorWallet = anchorWallet;
        this.wallet = wallet || null;
        this.location = location;

        this.cluster = cluster || "http://127.0.0.1:8899";
        this.connection = new Connection(this.cluster, "confirmed");

        this.provider = new AnchorProvider(
            this.connection,
            this.anchorWallet,
            AnchorProvider.defaultOptions()
        );
        this.programId =
            programId || new PublicKey(workspace.Christmas.programId);
        this.program = new Program<Christmas>(
            idl as any,
            this.programId,
            this.provider
        );

        console.log(
            `Connected to cluster: ${this.cluster} program: ${this.programId}`
        );
    }

    /*
    Coupons
    */

    getCouponPda(mint: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [utils.bytes.utf8.encode("coupon"), mint.toBuffer()],
            this.program.programId
        );
    }

    getRegionMarketPda(region: number[]): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [utils.bytes.utf8.encode("market"), Uint8Array.from(region)],
            this.program.programId
        );
    }

    async createCoupon({
        geohash,
        region,
        name,
        uri,
        store,
        mint,
        validFrom,
        validTo,
    }: {
        geohash: number[];
        region: number[];
        name: string;
        uri: string;
        store: PublicKey;
        validFrom: Date;
        validTo: Date;
        mint?: Keypair;
    }): Promise<TransactionResult> {
        // generate new mint keys if not provided
        if (mint === undefined) {
            mint = Keypair.generate();
        }

        // calculate region market accounts
        const [regionMarketPda, regionMarketTokenAccountPda] =
            await this.getRegionMarketPdasFromMint(mint.publicKey, region);

        // calculate couponPda
        const [couponPda, _] = this.getCouponPda(mint.publicKey);

        // create coupon
        const ix = await this.program.methods
            .createCoupon(
                name,
                region,
                geohash,
                uri,
                new BN(validFrom.getTime()),
                new BN(validTo.getTime())
            )
            .accounts({
                mint: mint.publicKey,
                coupon: couponPda,
                store: store,
                signer: this.anchorWallet.publicKey,
                systemProgram: SystemProgram.programId,
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
     * Redeems a coupon for a specified mint from a user, essentially burning the user's token.
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
        coupon: PublicKey;
        mint: PublicKey;
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
            .redeemCoupon(new BN(numTokens))
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
        signature: TransactionSignature;
        mint: PublicKey;
        wallet: PublicKey;
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

    async getMintedCoupons(
        store?: PublicKey
    ): Promise<[Account<Coupon>, number, number][]> {
        let filters = [
            {
                memcmp: {
                    offset: DISCRIMINATOR_SIZE,
                    bytes: this.anchorWallet.publicKey.toBase58(), // update_authority
                },
            },
        ];

        if (store) {
            filters.push({
                memcmp: {
                    offset: OFFSET_TO_STORE,
                    bytes: store.toBase58(), // store
                },
            });
        }

        const mintedCoupons = await this.program.account.coupon.all(filters);

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
        region: number[],
        date?: Date
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
                (x.account.data as ParsedAccountData).parsed.info.tokenAmount
                    .uiAmount > 0
        );

        // get today
        const today = date || new Date();

        // get location
        let geohash = this.location?.geohash ?? (await getGeohash());

        // get coupons for mints in accountsWithBalance
        return (
            await Promise.allSettled(
                accountsWithBalance.map(async (tokenAccount) => {
                    // get mint
                    const mint = (
                        tokenAccount.account.data as ParsedAccountData
                    ).parsed.info.mint;

                    const xs = await this.program.account.coupon.all([
                        // filter mint
                        {
                            memcmp: {
                                offset: DISCRIMINATOR_SIZE + PUBKEY_SIZE,
                                bytes: mint,
                            },
                        },
                        // filter within range (reduce 1 precision level to get surrounding (TODO: this is not accurate for borders)
                        {
                            memcmp: {
                                offset: OFFSET_TO_GEO,
                                bytes: bs58.encode(geohash.slice(0, -1)),
                            },
                        },
                    ]);

                    // only return if in validity period
                    if (
                        xs.length > 0 &&
                        timeStampToDate(xs[0].account.validFrom) <= today &&
                        timeStampToDate(xs[0].account.validTo) >= today
                    ) {
                        return [xs[0], tokenAccount];
                    } else {
                        throw new Error("Coupon expired");
                    }
                })
            )
        )
            .filter((result) => {
                if (result.status !== "fulfilled") {
                    console.warn(result.reason);
                }

                return result && result.status === "fulfilled";
            })
            .map(
                (result) =>
                    (
                        result as PromiseFulfilledResult<
                            [Account<Coupon>, TokenAccount]
                        >
                    ).value
            );
    }

    async getCouponsEfficiently(
        region: number[],
        date?: Date
    ): Promise<Account<Coupon>[]> {
        // get today
        const today = date || new Date();

        // get location
        let geo = this.location?.geohash ?? (await getGeohash());

        const filters = getDateWithinRangeFilterCombinations(today).map(
            (dateFilters) => {
                // TODO: need to bunch all the memcmp fields together as solana only accepts max of 4 filters, each 128 bytes
                return [
                    // // region
                    // {
                    //     memcmp: {
                    //         offset: OFFSET_TO_REGION + STRING_PREFIX_SIZE,
                    //         bytes: stringToBase58(region),
                    //     },
                    // },
                    // // has supply
                    // {
                    //     memcmp: {
                    //         offset: OFFSET_TO_HAS_SUPPLY,
                    //         bytes: bs58.encode(Uint8Array.from([1])),
                    //     },
                    // },
                    // // within range
                    // {
                    //     memcmp: {
                    //         offset: OFFSET_TO_GEO + STRING_PREFIX_SIZE,
                    //         bytes: stringToBase58(geo.slice(0, -1)), // reduce 1 precision level to get surrounding (TODO: this is not accurate for borders)
                    //     },
                    // },
                    // within validity period
                    ...dateFilters,
                ];
            }
        );

        return (
            await Promise.allSettled(
                filters.map(async (filter) => {
                    return await this.program.account.coupon.all(filter);
                })
            )
        )
            .filter((result) => {
                if (result.status !== "fulfilled") {
                    console.warn(result.reason);
                }
                return result && result.status === "fulfilled";
            })
            .flatMap(
                (result) =>
                    (result as PromiseFulfilledResult<Account<Coupon>[]>).value
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
                    (x.account.data as ParsedAccountData).parsed.info
                        .tokenAmount.uiAmount > 0
            )
            .map((x) => [
                (x.account.data as ParsedAccountData).parsed.info.mint,
                (x.account.data as ParsedAccountData).parsed.info.tokenAmount
                    .uiAmount,
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
        mint: PublicKey,
        region?: number[]
    ): Promise<[PublicKey, PublicKey]> {
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

    async mintToMarket({
        mint,
        coupon,
        region,
        numTokens,
    }: {
        mint: PublicKey;
        coupon: PublicKey;
        region: number[];
        numTokens: number;
    }): Promise<TransactionResult> {
        // the region is the coupon.region of the respective mint
        const [regionMarketPda, regionMarketTokenAccountPda] =
            await this.getRegionMarketPdasFromMint(mint);

        // mint numTokens to region market
        const ix = await this.program.methods
            .mintToMarket(region, new BN(numTokens))
            .accounts({
                regionMarket: regionMarketPda,
                regionMarketTokenAccount: regionMarketTokenAccountPda,
                mint: mint,
                coupon: coupon,
                signer: this.anchorWallet.publicKey,
                systemProgram: SystemProgram.programId,
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
        mint: PublicKey,
        numTokens: number,
        region?: number[] | null,
        geohash?: number[] | null
    ): Promise<TransactionResult> {
        const ix = await this.claimFromMarketIx({
            mint,
            numTokens,
            region,
            geohash,
        });

        // Create a new transaction, add the instruction, and execute the transaction.
        const tx = new Transaction();
        tx.add(ix);
        return await this.executeTransaction(tx);
    }

    async claimFromMarketIx({
        mint,
        numTokens,
        region,
        geohash,
        wallet,
    }: {
        mint: PublicKey;
        numTokens: number;
        region?: number[] | null;
        geohash?: number[] | null;
        wallet?: PublicKey | null;
    }): Promise<TransactionInstruction> {
        // Get the Program Derived Addresses (PDAs) for the region market and the associated token account.
        const [regionMarketPda, regionMarketTokenAccountPda] =
            await this.getRegionMarketPdasFromMint(mint);

        // Check if a user exists, and create one if not. (TODO: Get rid of user, just use wallet)
        const user = await this.getUser();
        if (user === null) {
            if (region == null) {
                region = getCountry().code;
            }
            if (!geohash) {
                geohash = await getGeohash();
            }
            await this.createUser({ region, geohash });
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
        return await this.program.methods
            .claimFromMarket(new BN(numTokens))
            .accounts({
                user: userPda,
                userTokenAccount: userTokenAccount,
                coupon: couponPda,
                regionMarket: regionMarketPda,
                regionMarketTokenAccount: regionMarketTokenAccountPda,
                mint: mint,
                signer: this.anchorWallet.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .instruction();
    }

    /*
    Store
    */

    getStorePda(id: BN, owner?: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [
                utils.bytes.utf8.encode("store"),
                owner
                    ? owner.toBuffer()
                    : this.anchorWallet.publicKey.toBuffer(),
                id.toArrayLike(Buffer, "be", 8),
            ],
            this.program.programId
        );
    }

    async createStore({
        name,
        uri,
        region,
        geohash,
    }: {
        name: string;
        uri: string;
        region: number[];
        geohash: number[];
    }): Promise<TransactionResult> {
        const storeId = await this.getAvailableStoreId();
        const storePda = this.getStorePda(storeId)[0];
        const programStatePda = this.getProgramStatePda()[0];

        if (name.length > STORE_NAME_SIZE - STRING_PREFIX_SIZE) {
            throw Error(
                `Store name exceeds maximum length of ${STORE_NAME_SIZE}`
            );
        }

        if (uri.length > URI_SIZE - STRING_PREFIX_SIZE) {
            throw Error(`Uri exceeds maximum length of ${URI_SIZE}`);
        }

        return await this.executeTransaction(
            new Transaction().add(
                await this.program.methods
                    .createStore(name, storeId, region, geohash, uri)
                    .accounts({
                        store: storePda,
                        signer: this.anchorWallet.publicKey,
                        systemProgram: SystemProgram.programId,
                        state: programStatePda,
                    })
                    .instruction()
            )
        );
    }

    async getStore(id: BN, owner?: PublicKey): Promise<Store> {
        const [storePda, _] = this.getStorePda(id, owner);
        return await this.program.account.store.fetch(storePda);
    }

    async getStoreByPda(pda: PublicKey): Promise<Store> {
        return await this.program.account.store.fetch(pda);
    }

    async getStores(owner?: PublicKey): Promise<Account<Store>[]> {
        return this.program.account.store.all([
            {
                memcmp: {
                    offset:
                        DISCRIMINATOR_SIZE +
                        U64_SIZE +
                        STORE_NAME_SIZE +
                        REGION_SIZE +
                        GEOHASH_SIZE +
                        URI_SIZE,
                    bytes: owner
                        ? owner.toBase58()
                        : this.anchorWallet.publicKey.toBase58(), // owner
                },
            },
        ]);
    }

    async getAvailableStoreId(): Promise<BN> {
        const state = await this.getProgramState();
        return state.storeCounter;
    }

    /*
    User
    */

    getUserPda(wallet?: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [
                utils.bytes.utf8.encode("user"),
                wallet
                    ? wallet.toBuffer()
                    : this.anchorWallet.publicKey.toBuffer(),
            ],
            this.program.programId
        );
    }

    async getUserTokenAccount(
        mint: PublicKey,
        wallet?: PublicKey
    ): Promise<PublicKey> {
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
        geohash,
        region,
    }: {
        geohash: number[];
        region: number[];
    }): Promise<TransactionResult> {
        const [pda, _] = this.getUserPda();

        const ix = await this.program.methods
            .createUser(region, geohash)
            .accounts({
                user: pda,
                signer: this.anchorWallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .instruction();

        const tx = new Transaction();
        tx.add(ix);

        return await this.executeTransaction(tx);
    }

    /*
    Program
    */

    getProgramStatePda(): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [utils.bytes.utf8.encode("state")],
            this.programId
        );
    }

    async initializeProgram(): Promise<TransactionResult> {
        const [programStatePda, _] = this.getProgramStatePda();
        return await this.executeTransaction(
            new Transaction().add(
                await this.program.methods
                    .initialize()
                    .accounts({
                        programState: programStatePda,
                        signer: this.anchorWallet.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction()
            )
        );
    }

    async getProgramState(): Promise<ProgramState> {
        const [programStatePda, _] = this.getProgramStatePda();
        return await this.program.account.programState.fetch(programStatePda);
    }

    /*
    Utils
    */

    async confirmTransaction(
        signature: string,
        commitment?: Commitment
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

        console.log(
            `Transaction: ${signature}\nResult:\n${JSON.stringify(
                result,
                null,
                2
            )}`
        );

        return { result, signature };
    }

    async executeTransaction(
        tx: Transaction,
        signers?: Array<Signer>,
        options?: SendOptions
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
            (await this.anchorWallet.signTransaction(tx)).serialize(),
            // options
            // REMOVE FOR DEBUG ONLY
            {
                skipPreflight: true,
            }
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
}
