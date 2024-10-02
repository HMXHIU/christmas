import { JWT_SECRET_KEY, REFRESH_JWT_SECRET_KEY } from "$env/static/private";
import {
    PUBLIC_JWT_EXPIRES_IN,
    PUBLIC_REFRESH_JWT_EXPIRES_IN,
} from "$env/static/public";
import {
    CouponMetadataSchema,
    CreateCouponSchema,
    CreateStoreSchema,
    MemberMetadataSchema,
    MintCouponSchema,
    StoreMetadataSchema,
    type Coupon,
    type CouponAccount,
    type Store,
} from "$lib/community/types";
import { COUNTRY_DETAILS } from "$lib/userDeviceClient/defs";
import { imageDataUrlToFile } from "$lib/utils";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
    createSignInDataForSIWS,
    generateNonce,
    hashObject,
    signJWT,
    verifyJWT,
    verifySIWS,
} from "..";
import { getOrCreateEntity } from "../crossover/redis/utils";
import { ObjectStorage } from "../objectStorage";
import { authProcedure, publicProcedure, t } from "../trpc";
import { getOrCreateMember, getUser } from "../user";
import {
    couponAccountRepository,
    couponRepository,
    storeRepository,
} from "./redis";
import type { CouponEntity, StoreEntity } from "./redis/schema";

export { communityRouter };

const COUPON_PAGE_SIZE = 20;

// Schema
const LoginSchema = z.object({
    solanaSignInInput: z.any(),
    solanaSignInOutput: z.any(),
});

const ClaimCouponSchema = z.object({
    numTokens: z.number().positive().int(),
    coupon: z.string(),
});

const RedeemCouponSchema = z.object({
    coupon: z.string(),
    numTokens: z.number().positive().int(),
});

const VerifyRedemptionSchema = z.object({
    signature: z.string(),
    coupon: z.string(),
    wallet: z.string(),
    numTokens: z.number().positive().int(),
});

const MarketSchema = z.object({
    region: z.string(),
    geohash: z.string(),
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

                // Coupon id
                const coupon = generateNonce(32);

                // Upload coupon image to image bucket
                const imageUrl = await ObjectStorage.putObject(
                    {
                        owner: null,
                        bucket: "image",
                        name: hashObject(["image", ctx.user.publicKey, coupon]), // we can find it via this hash
                        data: Buffer.from(await imageFile.arrayBuffer()),
                    },
                    { "Content-Type": imageFile.type },
                );

                // Validate & upload couponMetadata to coupon bucket
                const couponMetadataUrl = await ObjectStorage.putJSONObject({
                    owner: null,
                    bucket: "coupon",
                    name: hashObject(["coupon", ctx.user.publicKey, coupon]), // we can find it via this hash
                    data: await CouponMetadataSchema.parse({
                        name,
                        description,
                        image: imageUrl,
                    }),
                });

                let couponEntity: Coupon = {
                    coupon,
                    region,
                    geohash,
                    name,
                    uri: couponMetadataUrl,
                    store,
                    validFrom,
                    validTo,
                    owner: ctx.user.publicKey,
                };

                // Save CouponEntity
                couponEntity = (await couponRepository.save(
                    coupon,
                    couponEntity,
                )) as CouponEntity;

                // TODO: SOLANA SIGNED MESSAGE
            }),

        // coupon.mint
        mint: authProcedure
            .input(MintCouponSchema)
            .mutation(async ({ ctx, input }) => {
                const { region, coupon, numTokens } = input;

                // Get the region coupon account id
                const regionAccountId = hashObject([coupon, region]);
                const regionAccount = await getOrCreateEntity<CouponAccount>(
                    regionAccountId,
                    {
                        account: regionAccountId,
                        owner: region,
                        supply: 0,
                        coupon,
                    },
                    couponAccountRepository,
                );
                regionAccount.supply += numTokens;
                await couponAccountRepository.save(
                    regionAccountId,
                    regionAccount,
                );

                // TODO: SOLANA SIGNED MESSAGE
            }),
        // coupon.claim
        claim: authProcedure
            .input(ClaimCouponSchema)
            .mutation(async ({ ctx, input }) => {
                const { numTokens, coupon } = input;

                // Get the coupon region
                const couponEntity = (await couponRepository.fetch(
                    coupon,
                )) as CouponEntity;
                if (!couponEntity) {
                    throw new Error(`${coupon} does not exists`);
                }

                // Get the region account
                const regionAccountId = hashObject([
                    coupon,
                    couponEntity.region,
                ]);
                const regionAccount = await getOrCreateEntity<CouponAccount>(
                    regionAccountId,
                    {
                        account: regionAccountId,
                        owner: couponEntity.region,
                        supply: 0,
                        coupon,
                    },
                    couponAccountRepository,
                );

                // Get user  account
                const userAccountId = hashObject([coupon, ctx.user.publicKey]);
                const userAccount = await getOrCreateEntity<CouponAccount>(
                    userAccountId,
                    {
                        account: userAccountId,
                        owner: ctx.user.publicKey,
                        supply: 0,
                        coupon,
                    },
                    couponAccountRepository,
                );

                if (regionAccount.supply >= numTokens) {
                    regionAccount.supply -= numTokens;
                    userAccount.supply += numTokens;

                    await couponAccountRepository.save(
                        regionAccount.account,
                        regionAccount,
                    );
                    await couponAccountRepository.save(
                        userAccount.account,
                        userAccount,
                    );
                } else {
                    throw new Error(
                        `${couponEntity.region} does not have sufficient ${coupon} to be claimed.`,
                    );
                }

                // TODO: SOLANA SIGNED MESSAGE
            }),
        // coupon.redeem
        redeem: authProcedure
            .input(RedeemCouponSchema)
            .mutation(async ({ ctx, input }) => {
                const { coupon, numTokens } = input;

                // Get user  account
                const userAccountId = hashObject([coupon, ctx.user.publicKey]);
                const userAccount = await getOrCreateEntity<CouponAccount>(
                    userAccountId,
                    {
                        account: userAccountId,
                        owner: ctx.user.publicKey,
                        supply: 0,
                        coupon,
                    },
                    couponAccountRepository,
                );

                if (userAccount.supply >= numTokens) {
                    userAccount.supply -= numTokens;
                    await couponAccountRepository.save(
                        userAccount.account,
                        userAccount,
                    );
                } else {
                    throw new Error(
                        `${ctx.user.publicKey} does not have sufficient ${coupon} to redeem.`,
                    );
                }

                // TODO: SOLANA SIGNED MESSAGE
            }),
        // coupon.verify
        verify: authProcedure
            .input(VerifyRedemptionSchema)
            .query(async ({ ctx, input }) => {
                const { signature, coupon, wallet, numTokens } = input;

                // TODO: Not implemented

                return {
                    isVerified: true,
                    err: "",
                };
            }),
        // coupon.market
        market: authProcedure
            .input(MarketSchema)
            .query(async ({ ctx, input }) => {
                const { region, geohash } = input;

                const accounts = (await couponAccountRepository
                    .search()
                    .where("owner")
                    .equal(region)
                    .and("supply")
                    .greaterThan(0)
                    .returnAll({
                        pageSize: COUPON_PAGE_SIZE,
                    })) as CouponAccount[];

                const coupons: [Coupon, number][] = await Promise.all(
                    accounts.map(({ coupon, supply }) => {
                        return couponRepository.fetch(coupon).then((e) => {
                            return [e as Coupon, supply] as [Coupon, number];
                        });
                    }),
                );

                return coupons;
            }),
        // coupon.claimed
        claimed: authProcedure.query(async ({ ctx }) => {
            const accounts = (await couponAccountRepository
                .search()
                .where("owner")
                .equal(ctx.user.publicKey)
                .and("supply")
                .greaterThan(0)
                .returnAll({ pageSize: COUPON_PAGE_SIZE })) as CouponAccount[];

            const coupons: [Coupon, number][] = await Promise.all(
                accounts.map(({ coupon, supply }) => {
                    return couponRepository.fetch(coupon).then((e) => {
                        return [e as Coupon, supply] as [Coupon, number];
                    });
                }),
            );

            return coupons;
        }),
        // coupon.minted
        minted: authProcedure
            .input(z.object({ store: z.string() }))
            .query(async ({ ctx, input }) => {
                const { store } = input;

                const coupons = (await couponRepository
                    .search()
                    .where("store")
                    .equal(store)
                    .and("owner")
                    .equal(ctx.user.publicKey)
                    .returnAll({
                        pageSize: COUPON_PAGE_SIZE,
                    })) as CouponEntity[];

                let couponBalances: [Coupon, number, number][] = [];

                for (const c of coupons) {
                    const { region, coupon } = c;
                    const regionAccount = await couponAccountRepository
                        .search()
                        .where("coupon")
                        .equal(c.coupon)
                        .and("owner")
                        .equal(c.region)
                        .first();
                    if (regionAccount) {
                        const supply = (regionAccount as CouponAccount).supply;
                        couponBalances.push([c, supply, supply]);
                    }
                }

                return couponBalances;
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
                const storeId = hashObject([
                    ctx.user.publicKey,
                    region,
                    generateNonce(),
                ]);

                // Upload store image
                const imageUrl = await ObjectStorage.putObject(
                    {
                        owner: null,
                        bucket: "image",
                        name: hashObject(["image", storeId]),
                        data: Buffer.from(await imageFile.arrayBuffer()),
                    },
                    { "Content-Type": imageFile.type },
                );

                // Validate & upload store metadata
                const storeMetadataUrl = await ObjectStorage.putJSONObject(
                    {
                        owner: null,
                        bucket: "store",
                        name: hashObject(["store", storeId]),
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

                let store: Store = {
                    store: storeId,
                    region,
                    geohash,
                    name,
                    uri: storeMetadataUrl,
                    owner: ctx.user.publicKey,
                };

                // Save StoreEntity
                const storeEntity = (await storeRepository.save(
                    storeId,
                    store,
                )) as CouponEntity;

                // TODO: SOLANA SIGNED MESSAGE
            }),

        // store.user
        user: authProcedure.query(async ({ ctx }) => {
            const stores = (await storeRepository
                .search()
                .where("owner")
                .equal(ctx.user.publicKey)
                .returnAll()) as StoreEntity[];
            return stores as Store[];
        }),

        // store.store
        store: authProcedure
            .input(z.object({ store: z.string() }))
            .query(async ({ ctx, input }) => {
                const { store } = input;
                return (await storeRepository.fetch(store)) as Store;
            }),
    }),
    user: t.router({
        // user.create
        create: authProcedure
            .input(MemberMetadataSchema)
            .mutation(async ({ ctx, input }) => {
                // Check valid region
                try {
                    COUNTRY_DETAILS[input.region];
                } catch (err) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Invalid input.region: ${input.region}`,
                    });
                }
                return await getOrCreateMember(ctx.user.publicKey, input);
            }),
        // user.user
        user: authProcedure.query(async ({ ctx }) => {
            return await getUser(ctx.user.publicKey);
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
