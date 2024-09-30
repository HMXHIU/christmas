import { PublicKey, Transaction, type HttpHeaders } from "@solana/web3.js";
import {
    type Account,
    type Coupon,
    type Store,
    type TransactionResult,
} from "../anchorClient/types";

import { logout as logoutCrossoover } from "$lib/crossover/client";
import type {
    CouponMetadataSchema,
    StoreMetadataSchema,
} from "$lib/server/community/router";
import { trpc } from "$lib/trpcClient";
import { signAndSendTransaction } from "$lib/utils";
import type { UserMetadata } from "$lib/utils/user";
import type { HTTPHeaders } from "@trpc/client";
import { get } from "svelte/store";
import { z } from "zod";
import {
    claimedCoupons,
    couponsMetadata,
    marketCoupons,
    mintedCoupons,
    player,
    redeemedCoupons,
    stores,
    storesMetadata,
    token,
} from "../../store";
import { stringToUint8Array } from "../utils";
import {
    deserializeCouponBalance,
    deserializeCouponSupplyBalance,
    deserializeStoreAccount,
} from "./utils";

// Exports
export {
    claimCoupon,
    createCoupon,
    createMember,
    createStore,
    fetchClaimedCoupons,
    fetchCouponMetadata,
    fetchMarketCoupons,
    fetchMintedCouponSupplyBalance,
    fetchStoreMetadata,
    fetchStores,
    fetchUser,
    login,
    logout,
    MemberMetadataSchema,
    mintCoupon,
    redeemCoupon,
    refresh,
    verifyRedemption,
    type ClaimCouponParams,
    type CreateCouponParams,
    type CreateStoreParams,
    type MemberMetadata,
    type MintCouponParams,
    type RedeemCouponParams,
};

interface MintCouponParams {
    coupon: Account<Coupon>;
    numTokens: number;
}

interface CreateCouponParams {
    name: string;
    description: string;
    validFrom: Date;
    validTo: Date;
    image: string;
    store: Account<Store>;
}

interface ClaimCouponParams {
    numTokens: number;
    coupon: Account<Coupon>;
}

interface RedeemCouponParams {
    numTokens: number;
    coupon: Account<Coupon>;
}

interface CreateStoreParams {
    name: string;
    description: string;
    region: number[];
    geohash: number[];
    latitude: number;
    longitude: number;
    address: string;
    image: string;
}

const MemberMetadataSchema = z.object({
    region: z.string(),
});

type MemberMetadata = z.infer<typeof MemberMetadataSchema>;

/*
 * Coupon
 */

async function fetchMarketCoupons(
    {
        region,
        geohash,
    }: {
        region: number[] | string;
        geohash: number[] | string;
    },
    headers: HTTPHeaders = {},
): Promise<[Account<Coupon>, number][]> {
    const coupons = (
        await trpc({ headers }).community.coupon.market.query({
            region:
                typeof region === "string"
                    ? Array.from(stringToUint8Array(region))
                    : region,
            geohash:
                typeof geohash === "string"
                    ? Array.from(stringToUint8Array(geohash))
                    : geohash,
        })
    ).map(deserializeCouponBalance);

    // Update `$marketCoupons`
    marketCoupons.set(coupons);

    return coupons;
}

async function fetchCouponMetadata(
    coupon: Account<Coupon>,
    headers: HeadersInit = {},
): Promise<z.infer<typeof CouponMetadataSchema>> {
    const couponMetadata = await fetch(coupon.account.uri, { headers }).then(
        async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
        },
    );

    // Update `$couponMetadata`
    couponsMetadata.update((d) => {
        d[coupon.publicKey.toString()] = couponMetadata;
        return d;
    });

    return couponMetadata;
}

async function fetchMintedCouponSupplyBalance(
    store: PublicKey | string,
    headers: HTTPHeaders = {},
): Promise<[Account<Coupon>, number, number][]> {
    store = store instanceof PublicKey ? store.toBase58() : store;

    const couponsSupplyBalance = await trpc({ headers })
        .community.coupon.minted.query({
            store: store,
        })
        .then((coupons) => {
            return coupons.map(deserializeCouponSupplyBalance);
        });

    // Update `$mintedCoupons`
    mintedCoupons.update((d) => {
        d[store as string] = couponsSupplyBalance;
        return d;
    });

    return couponsSupplyBalance;
}

async function fetchClaimedCoupons(
    headers: HTTPHeaders = {},
): Promise<[Account<Coupon>, number][]> {
    const coupons = await trpc({ headers })
        .community.coupon.claimed.query()
        .then((coupons) => {
            return coupons.map(deserializeCouponBalance);
        });

    // Update `$claimedCoupons`
    claimedCoupons.set(coupons);

    return coupons;
}

async function claimCoupon(
    { coupon, numTokens }: ClaimCouponParams,
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({ headers: options?.headers || {} })
        .community.coupon.claim.mutate({
            numTokens,
            mint: coupon.account.mint.toString(),
        })
        .then(({ transaction }) => {
            return signAndSendTransaction({
                tx: Transaction.from(Buffer.from(transaction, "base64")),
                wallet: options?.wallet,
                commitment: "confirmed",
            });
        });
}

async function redeemCoupon(
    { coupon, numTokens }: RedeemCouponParams,
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({ headers: options?.headers || {} })
        .community.coupon.redeem.mutate({
            coupon: coupon.publicKey.toString(),
            numTokens,
            mint: coupon.account.mint.toString(),
        })
        .then(({ transaction }) => {
            return signAndSendTransaction({
                tx: Transaction.from(Buffer.from(transaction, "base64")),
                wallet: options?.wallet,
                commitment: "confirmed",
            });
        });
}

async function createCoupon(
    { image, name, description, validFrom, validTo, store }: CreateCouponParams,
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({ headers: options?.headers || {} })
        .community.coupon.create.mutate({
            image,
            name,
            description,
            validFrom,
            validTo,
            store: store.publicKey.toString(),
            geohash: store.account.geohash,
            region: store.account.region,
        })
        .then(({ transaction }) => {
            return signAndSendTransaction({
                tx: Transaction.from(Buffer.from(transaction, "base64")),
                wallet: options?.wallet,
                commitment: "confirmed",
            });
        });
}

async function mintCoupon(
    { coupon, numTokens }: MintCouponParams,
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({ headers: options?.headers || {} })
        .community.coupon.mint.mutate({
            mint: coupon.account.mint.toBase58(),
            region: coupon.account.region,
            coupon:
                coupon.publicKey instanceof PublicKey
                    ? coupon.publicKey.toBase58()
                    : coupon.publicKey,
            numTokens,
        })
        .then(({ transaction }) => {
            return signAndSendTransaction({
                tx: Transaction.from(Buffer.from(transaction, "base64")),
                wallet: options?.wallet,
                commitment: "confirmed",
            });
        });
}

async function verifyRedemption(
    {
        signature,
        mint,
        numTokens,
        wallet,
    }: {
        signature: string;
        mint: string;
        numTokens: number;
        wallet: string;
    },
    headers: HTTPHeaders = {},
): Promise<{ isVerified: boolean; err: string }> {
    return await trpc({ headers }).community.coupon.verify.query({
        signature,
        mint,
        wallet,
        numTokens,
    });
}

/*
 * Store
 */

async function fetchStores(
    headers: HTTPHeaders = {},
): Promise<Account<Store>[]> {
    const userStores = (
        await trpc({ headers }).community.store.user.query()
    ).map(deserializeStoreAccount);

    // Update `$stores`
    stores.set(userStores);

    return userStores;
}

async function fetchStoreMetadata(
    storePda: PublicKey | string,
    headers: HTTPHeaders = {},
): Promise<z.infer<typeof StoreMetadataSchema>> {
    if (storePda instanceof PublicKey) {
    }
    storePda = storePda instanceof PublicKey ? storePda.toBase58() : storePda;
    const store = await trpc({ headers }).community.store.store.query({
        store: storePda,
    });
    const storeMetadata = await (await fetch(store.uri)).json();

    // Update `$storeMetadata`
    storesMetadata.update((d) => {
        d[storePda as string] = storeMetadata;
        return d;
    });

    return storeMetadata;
}

async function createStore(
    {
        name,
        description,
        address,
        region,
        latitude,
        longitude,
        geohash,
        image,
    }: CreateStoreParams,
    options?: { headers?: HttpHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({ headers: options?.headers || {} })
        .community.store.create.mutate({
            name,
            description,
            address,
            region,
            latitude,
            longitude,
            geohash,
            image,
        })
        .then(({ transaction }) => {
            return signAndSendTransaction({
                tx: Transaction.from(Buffer.from(transaction, "base64")),
                wallet: options?.wallet,
                commitment: "confirmed",
            });
        });
}

/*
 * User
 */

async function fetchUser(headers: HTTPHeaders = {}): Promise<UserMetadata> {
    return await trpc({ headers }).community.user.user.query();
}

async function createMember(
    member: MemberMetadata,
    options?: { headers?: HTTPHeaders },
): Promise<MemberMetadata> {
    return await trpc({
        headers: options?.headers || {},
    }).community.user.create.mutate(member);
}

/*
 * Auth
 */

async function login() {
    const solanaSignInInput = await trpc().community.auth.siws.query();
    const solanaSignInOutput = await window.solana.signIn(solanaSignInInput);

    const { status, token: loginToken } =
        await trpc().community.auth.login.mutate({
            solanaSignInInput,
            solanaSignInOutput,
        });

    if (status !== "success" || loginToken == null) {
        throw new Error("Failed to log in");
    }

    // Set token in store (fallback if cookies not allowed)
    token.set(loginToken);
}

async function logout() {
    try {
        // Logout of crossover while we still have the token
        if (get(player) != null) {
            await logoutCrossoover();
        }

        await trpc().community.auth.logout.query();

        // await fetch(`${PUBLIC_HOST || ""}/api/auth/logout`, { method: "POST" });
        await window.solana.disconnect();
        token.set(null);

        // clear all stores
        marketCoupons.set([]);
        claimedCoupons.set([]);
        mintedCoupons.set({});
        redeemedCoupons.set({});
    } catch (error) {
        // If logout fails, reload the page (window.solana.disconnect() might fail if user is not logged in)
        console.error("Failed to log out", error);
        await window.solana.disconnect();
        location.reload();
    }
}

async function refresh(headers: HTTPHeaders = {}) {
    const { status, token: loginToken } = await trpc({
        headers,
    }).community.auth.refresh.query();

    if (status !== "success" || loginToken == null) {
        throw new Error("Failed to refresh token");
    }
    console.log("Refreshed token");

    // Set token in store (fallback if cookies not allowed)
    token.set(loginToken);
}
