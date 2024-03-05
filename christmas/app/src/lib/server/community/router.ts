import { JWT_SECRET_KEY, REFRESH_JWT_SECRET_KEY } from "$env/static/private";
import {
    PUBLIC_JWT_EXPIRES_IN,
    PUBLIC_REFRESH_JWT_EXPIRES_IN,
} from "$env/static/public";
import {
    cleanCouponBalance,
    cleanCouponSupplyBalance,
    cleanStore,
    cleanStoreAccount,
} from "$lib/community/utils";
import { COUNTRY_DETAILS } from "$lib/userDeviceClient/defs";
import { imageDataUrlToFile } from "$lib/utils";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
    FEE_PAYER_PUBKEY,
    createSerializedTransaction,
    createSignInDataForSIWS,
    hashObject,
    serverAnchorClient,
    signJWT,
    verifyJWT,
    verifySIWS,
} from "..";
import { UserMetadataSchema } from "../crossover/router";
import { ObjectStorage } from "../objectStorage";
import { authProcedure, publicProcedure, t } from "../trpc";

export {
    CouponMetadataSchema,
    CreateCouponSchema,
    CreateStoreSchema,
    CreateUserSchema,
    LoginSchema,
    StoreMetadataSchema,
    communityRouter,
};

// Schema
const LoginSchema = z.object({
    solanaSignInInput: z.any(),
    solanaSignInOutput: z.any(),
});
const CreateUserSchema = z.object({
    region: z.array(z.number()),
});
const CreateStoreSchema = z.object({
    name: z.string(),
    description: z.string(),
    region: z.array(z.number()),
    geohash: z.array(z.number()),
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
    image: z.string(),
});
const StoreMetadataSchema = z.object({
    name: z.string(),
    description: z.string(),
    image: z.string(),
    address: z.string(),
    latitude: z.number(),
    longitude: z.number(),
});
const CreateCouponSchema = z.object({
    name: z.string(),
    description: z.string(),
    region: z.array(z.number()),
    geohash: z.array(z.number()),
    store: z.string(),
    validFrom: z.coerce.date(),
    validTo: z.coerce.date(),
    image: z.string(),
});
const CouponMetadataSchema = z.object({
    name: z.string(),
    description: z.string(),
    image: z.string(),
});
const MintCouponSchema = z.object({
    region: z.array(z.number()),
    mint: z.string(),
    coupon: z.string(),
    numTokens: z.number().int().min(1).positive(),
});
const ClaimCouponSchema = z.object({
    numTokens: z.number().positive().int(),
    mint: z.string(),
});
const RedeemCouponSchema = z.object({
    coupon: z.string(),
    numTokens: z.number().positive().int(),
    mint: z.string(),
});
const VerifyRedemptionSchema = z.object({
    signature: z.string(),
    mint: z.string(),
    wallet: z.string(),
    numTokens: z.number().positive().int(),
});
const MarketCouponSchema = z.object({
    region: z.array(z.number()),
    geohash: z.array(z.number()),
});

// Router
const communityRouter = {
    // Coupon
    coupon: t.router({
        // coupon.create
        create: authProcedure
            .input(CreateCouponSchema)
            .mutation(async ({ ctx, input }) => {
                const {
                    geohash,
                    region,
                    name,
                    description,
                    store,
                    validFrom,
                    validTo,
                    image,
                } = input;

                const { mimeType, file: imageFile } =
                    await imageDataUrlToFile(image);

                // Generate a new mint for coupon
                const mint = Keypair.generate();

                // Upload image
                const imageUrl = await ObjectStorage.putObject(
                    {
                        owner: null,
                        bucket: "image",
                        name: hashObject([
                            "image",
                            ctx.user.publicKey,
                            mint.publicKey.toBase58(),
                        ]),
                        data: Buffer.from(await imageFile.arrayBuffer()),
                    },
                    { "Content-Type": imageFile.type },
                );

                // Validate & upload coupon metadata
                const metadata = await CouponMetadataSchema.parse({
                    name,
                    description,
                    image: imageUrl,
                });
                const couponMetadataUrl = await ObjectStorage.putJSONObject({
                    owner: null,
                    bucket: "coupon",
                    name: hashObject([
                        "coupon",
                        ctx.user.publicKey,
                        mint.publicKey.toBase58(),
                    ]),
                    data: metadata,
                });

                const ix = await serverAnchorClient.createCouponIx({
                    mint,
                    name,
                    region,
                    geohash,
                    store: new PublicKey(store),
                    validFrom,
                    validTo,
                    uri: couponMetadataUrl,
                    payer: FEE_PAYER_PUBKEY,
                    wallet: new PublicKey(ctx.user.publicKey),
                });

                const base64Transaction = await createSerializedTransaction(
                    ix,
                    [mint],
                ); // mint needs to sign as well
                return {
                    transaction: base64Transaction,
                };
            }),

        // coupon.mint
        mint: authProcedure
            .input(MintCouponSchema)
            .mutation(async ({ ctx, input }) => {
                // Validate request body
                const { region, mint, coupon, numTokens } = input;

                const ix = await serverAnchorClient.mintToMarketIx({
                    mint: new PublicKey(mint),
                    coupon: new PublicKey(coupon),
                    numTokens,
                    region,
                    payer: FEE_PAYER_PUBKEY,
                    wallet: new PublicKey(ctx.user.publicKey),
                });

                const base64Transaction = await createSerializedTransaction(ix);
                return {
                    transaction: base64Transaction,
                };
            }),
        // coupon.claim
        claim: authProcedure
            .input(ClaimCouponSchema)
            .mutation(async ({ ctx, input }) => {
                const { numTokens, mint } = input;

                const ix = await serverAnchorClient.claimFromMarketIx({
                    mint: new PublicKey(mint),
                    numTokens,
                    wallet: new PublicKey(ctx.user.publicKey),
                    payer: FEE_PAYER_PUBKEY,
                });

                const base64Transaction = await createSerializedTransaction(ix);
                return {
                    transaction: base64Transaction,
                };
            }),
        // coupon.redeem
        redeem: authProcedure
            .input(RedeemCouponSchema)
            .mutation(async ({ ctx, input }) => {
                const { coupon, numTokens, mint } = input;

                const ix = await serverAnchorClient.redeemCouponIx({
                    wallet: new PublicKey(ctx.user.publicKey),
                    payer: FEE_PAYER_PUBKEY,
                    coupon: new PublicKey(coupon),
                    numTokens,
                    mint: new PublicKey(mint),
                });

                const base64Transaction = await createSerializedTransaction(ix);
                return {
                    transaction: base64Transaction,
                };
            }),
        // coupon.verify
        verify: authProcedure
            .input(VerifyRedemptionSchema)
            .query(async ({ ctx, input }) => {
                const { signature, mint, wallet, numTokens } = input;

                const { isVerified, err } =
                    await serverAnchorClient.verifyRedemption({
                        mint: new PublicKey(mint),
                        wallet: new PublicKey(wallet),
                        numTokens,
                        signature,
                    });

                return {
                    isVerified,
                    err,
                };
            }),
        // coupon.market
        market: authProcedure
            .input(MarketCouponSchema)
            .query(async ({ ctx, input }) => {
                const { region, geohash } = input;
                return (
                    await serverAnchorClient.getCoupons({
                        region,
                        geohash,
                        date: new Date(), // current date
                    })
                ).map(cleanCouponBalance);
            }),
        // coupon.claimed
        claimed: authProcedure.query(async ({ ctx }) => {
            return (
                await serverAnchorClient.getClaimedCoupons(
                    new PublicKey(ctx.user.publicKey),
                )
            ).map(cleanCouponBalance);
        }),
        // coupon.minted
        minted: authProcedure
            .input(z.object({ store: z.string() }))
            .query(async ({ ctx, input }) => {
                const { store } = input;
                return (
                    await serverAnchorClient.getMintedCoupons({
                        store: new PublicKey(store),
                    })
                ).map(cleanCouponSupplyBalance);
            }),
    }),

    // Store
    store: t.router({
        // store.create
        create: authProcedure
            .input(CreateStoreSchema)
            .mutation(async ({ ctx, input }) => {
                const {
                    geohash,
                    region,
                    name,
                    description,
                    latitude,
                    longitude,
                    address,
                    image,
                } = input;

                const { mimeType, file: imageFile } =
                    await imageDataUrlToFile(image);

                // Get store id
                const storeId = await serverAnchorClient.getAvailableStoreId();

                // Store image
                const imageUrl = await ObjectStorage.putObject(
                    {
                        owner: null,
                        bucket: "image",
                        name: hashObject([
                            "image",
                            ctx.user.publicKey,
                            storeId.toNumber(),
                        ]),
                        data: Buffer.from(await imageFile.arrayBuffer()),
                    },
                    { "Content-Type": imageFile.type },
                );

                // Validate & upload store metadata
                const storeMetadataUrl = await ObjectStorage.putJSONObject(
                    {
                        owner: null,
                        bucket: "store",
                        name: hashObject([
                            "store",
                            ctx.user.publicKey,
                            storeId.toNumber(),
                        ]),
                        data: await StoreMetadataSchema.parse({
                            name,
                            description,
                            address,
                            latitude,
                            longitude,
                            image: imageUrl,
                        }),
                    },
                    { "Content-Type": "application/json" },
                );

                const ix = await serverAnchorClient.createStoreIx({
                    name,
                    uri: storeMetadataUrl,
                    region,
                    geohash,
                    storeId,
                    payer: FEE_PAYER_PUBKEY,
                    wallet: new PublicKey(ctx.user.publicKey),
                });

                const base64Transaction = await createSerializedTransaction(ix);
                return {
                    transaction: base64Transaction,
                };
            }),

        // store.user
        user: authProcedure.query(async ({ ctx }) => {
            // Note that store.id BN is serialized as string and needs to be deserialized on client
            return (
                await serverAnchorClient.getStores(
                    new PublicKey(ctx.user.publicKey),
                )
            ).map(cleanStoreAccount);
        }),

        // store.store
        store: authProcedure
            .input(z.object({ store: z.string() }))
            .query(async ({ ctx, input }) => {
                const { store: storePda } = input;

                return cleanStore(
                    await serverAnchorClient.getStoreByPda(
                        new PublicKey(storePda),
                    ),
                );
            }),
    }),

    // User
    user: t.router({
        // user.create
        create: authProcedure
            .input(CreateUserSchema)
            .mutation(async ({ ctx, input }) => {
                const user = ctx.user;
                const { region } = input;

                // Check valid region
                try {
                    COUNTRY_DETAILS[String.fromCharCode(...region)];
                } catch (err) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Invalid region: ${region}`,
                    });
                }

                // Validate & upload user metadata
                const userMetadataUrl = await ObjectStorage.putJSONObject(
                    {
                        owner: null,
                        bucket: "user",
                        name: hashObject(["user", user.publicKey]),
                        data: UserMetadataSchema.parse({
                            publicKey: user.publicKey,
                        }),
                    },
                    { "Content-Type": "application/json" },
                );

                const ix = await serverAnchorClient.createUserIx({
                    wallet: new PublicKey(user.publicKey),
                    payer: FEE_PAYER_PUBKEY,
                    region: region,
                    uri: userMetadataUrl,
                });

                const base64Transaction = await createSerializedTransaction(ix);
                return {
                    transaction: base64Transaction,
                };
            }),
        // user.user
        user: authProcedure.query(async ({ ctx }) => {
            return await serverAnchorClient.getUser(
                new PublicKey(ctx.user.publicKey),
            );
        }),
    }),

    // Authentication
    auth: t.router({
        // auth.siws (public)
        siws: publicProcedure.query(async ({ ctx }) => {
            return await createSignInDataForSIWS();
        }),
        // auth.login (public)
        login: publicProcedure
            .input(LoginSchema)
            .mutation(async ({ ctx, input }) => {
                // Verify solana signed message
                let { solanaSignInInput, solanaSignInOutput } = input;

                const isVerified = verifySIWS(
                    solanaSignInInput,
                    solanaSignInOutput,
                );

                // Authorized
                if (isVerified) {
                    const userSession: App.UserSession = {
                        publicKey: solanaSignInOutput.address,
                    };

                    // Set token and refresh token on cookies
                    const token = await signJWT(
                        userSession,
                        parseInt(PUBLIC_JWT_EXPIRES_IN),
                        JWT_SECRET_KEY,
                    );
                    const refreshToken = await signJWT(
                        userSession,
                        parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN),
                        REFRESH_JWT_SECRET_KEY,
                    );
                    // TODO: This seems to be setting 2 set-cookies headers
                    ctx.cookies.set("token", token, {
                        path: "/",
                        httpOnly: true,
                        secure: true,
                        sameSite: "strict",
                        maxAge: parseInt(PUBLIC_JWT_EXPIRES_IN), // in seconds
                    });
                    ctx.cookies.set("refreshToken", refreshToken, {
                        path: "/",
                        httpOnly: true,
                        secure: true,
                        sameSite: "strict",
                        maxAge: parseInt(PUBLIC_REFRESH_JWT_EXPIRES_IN), // in seconds
                    });

                    return { status: "success", token };
                }

                // Unauthorized
                else {
                    ctx.locals.user = null;
                    ctx.cookies.delete("token", {
                        path: "/",
                    });
                    ctx.cookies.delete("refreshToken", {
                        path: "/",
                    });
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "Unauthorized",
                    });
                }
            }),

        // auth.refresh (public)
        refresh: publicProcedure.query(async ({ ctx }) => {
            const refreshToken = ctx.cookies.get("refreshToken");

            // Check refreshToken
            if (!refreshToken) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Missing refreshToken",
                });
            }

            // Verify refresh token
            const userSession = (await verifyJWT(
                refreshToken,
                REFRESH_JWT_SECRET_KEY,
            )) as App.UserSession;

            // Check userSession has publicKey
            if (!userSession.publicKey) {
                console.log("Invalid refreshToken");
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Invalid refreshToken",
                });
            }

            // Create new token
            const token = await signJWT(
                { publicKey: userSession.publicKey },
                parseInt(PUBLIC_JWT_EXPIRES_IN),
                JWT_SECRET_KEY,
            );
            ctx.cookies.set("token", token, {
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: parseInt(PUBLIC_JWT_EXPIRES_IN), // in seconds
            });
            return { status: "success", token };
        }),

        // auth.logout (public)
        logout: publicProcedure.query(async ({ ctx }) => {
            ctx.locals.user = null;
            ctx.cookies.delete("token", {
                path: "/",
            });
            ctx.cookies.delete("refreshToken", {
                path: "/",
            });

            return { status: "success" };
        }),

        // auth.user
        user: authProcedure.query(async ({ ctx }) => {
            const user = ctx.locals.user;
            if (user == null) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "You are not logged in",
                });
            }
            return user;
        }),
    }),
};
