import { logout as logoutCrossoover } from "$lib/crossover/client";
import { trpc } from "$lib/trpcClient";
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
import {
    CouponSchema,
    type Coupon,
    type CouponMetadataSchema,
    type MemberMetadata,
    type MintCoupon,
    type Store,
    type StoreMetadataSchema,
    type TransactionResult,
} from "./types";

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
    mintCoupon,
    redeemCoupon,
    refresh,
    verifyRedemption,
};

/*
 * Coupon
 */

async function fetchMarketCoupons(
    {
        region,
        geohash,
    }: {
        region: string;
        geohash: string;
    },
    headers: HTTPHeaders = {},
): Promise<[Coupon, number][]> {
    let coupons = await trpc({ headers }).community.coupon.market.query({
        region,
        geohash,
    });

    const parsed = coupons.map(
        ([c, s]) => [CouponSchema.parse(c), s] as [Coupon, number],
    );

    // Update `$marketCoupons`
    marketCoupons.set(parsed);

    return parsed;
}

async function fetchCouponMetadata(
    coupon: Coupon,
    headers: HeadersInit = {},
): Promise<z.infer<typeof CouponMetadataSchema>> {
    const couponMetadata = await fetch(coupon.uri, { headers }).then(
        async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
        },
    );

    // Update `$couponMetadata`
    couponsMetadata.update((d) => {
        d[coupon.coupon] = couponMetadata;
        return d;
    });

    return couponMetadata;
}

async function fetchMintedCouponSupplyBalance(
    store: string,
    headers: HTTPHeaders = {},
): Promise<[Coupon, number, number][]> {
    const couponsSupplyBalance = await trpc({
        headers,
    }).community.coupon.minted.query({
        store: store,
    });

    const parsed = couponsSupplyBalance.map(
        ([c, b, s]) =>
            [CouponSchema.parse(c), s, b] as [Coupon, number, number],
    );

    // Update `$mintedCoupons`
    mintedCoupons.update((d) => {
        d[store] = parsed;
        return d;
    });

    return parsed;
}

async function fetchClaimedCoupons(
    headers: HTTPHeaders = {},
): Promise<[Coupon, number][]> {
    const coupons = await trpc({ headers }).community.coupon.claimed.query();

    const parsed = coupons.map(
        ([c, s]) => [CouponSchema.parse(c), s] as [Coupon, number],
    );

    // Update `$claimedCoupons`
    claimedCoupons.set(parsed);

    return parsed;
}

async function claimCoupon(
    { coupon, numTokens }: { coupon: Coupon; numTokens: number },
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({ headers: options?.headers || {} })
        .community.coupon.claim.mutate({
            numTokens,
            coupon: coupon.coupon,
        })
        .then(() => {
            return {
                result: { err: null },
                signature: "",
            };
        });
}

async function redeemCoupon(
    { coupon, numTokens }: { coupon: Coupon; numTokens: number },
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({ headers: options?.headers || {} })
        .community.coupon.redeem.mutate({
            coupon: coupon.coupon,
            numTokens,
        })
        .then(() => {
            return {
                result: { err: null },
                signature: "",
            };
        });
}

async function createCoupon(
    {
        image,
        name,
        description,
        validFrom,
        validTo,
        store,
        geohash,
        region,
    }: {
        image: string;
        name: string;
        description: string;
        validFrom: Date;
        validTo: Date;
        store: string;
        geohash: string;
        region: string;
    },
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({ headers: options?.headers || {} })
        .community.coupon.create.mutate({
            image,
            name,
            description,
            validFrom,
            validTo,
            store: store,
            geohash: geohash,
            region: region,
        })
        .then(() => {
            return {
                result: { err: null },
                signature: "",
            };
        });
}

async function mintCoupon(
    { coupon, numTokens, region }: MintCoupon,
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    return await trpc({ headers: options?.headers || {} })
        .community.coupon.mint.mutate({
            coupon: coupon,
            region: region,
            numTokens,
        })
        .then(() => {
            return {
                result: { err: null },
                signature: "",
            };
        });
}

async function verifyRedemption(
    {
        signature,
        coupon,
        numTokens,
        wallet,
    }: {
        signature: string;
        coupon: string;
        numTokens: number;
        wallet: string;
    },
    headers: HTTPHeaders = {},
): Promise<{ isVerified: boolean; err: string }> {
    return await trpc({ headers }).community.coupon.verify.query({
        signature,
        coupon,
        wallet,
        numTokens,
    });
}

/*
 * Store
 */

async function fetchStores(headers: HTTPHeaders = {}): Promise<Store[]> {
    const userStores = await trpc({ headers }).community.store.user.query();

    // Update `$stores`
    stores.set(userStores);

    return userStores;
}

async function fetchStoreMetadata(
    storeId: string,
    headers: HTTPHeaders = {},
): Promise<z.infer<typeof StoreMetadataSchema>> {
    const store = await trpc({ headers }).community.store.store.query({
        store: storeId,
    });
    const storeMetadata = await (await fetch(store.uri)).json();

    // Update `$storeMetadata`
    storesMetadata.update((d) => {
        d[store.store] = storeMetadata;
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
    }: {
        name: string;
        description: string;
        address: string;
        region: string;
        latitude: number;
        longitude: number;
        geohash: string;
        image: string;
    },
    options?: { headers?: HTTPHeaders; wallet?: any },
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
        .then(() => {
            return {
                result: { err: null },
                signature: "",
            };
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
        // Logout
        await trpc().community.auth.logout.query();

        await window.solana.disconnect();
        token.set(null);

        // clear all stores
        marketCoupons.set([]);
        claimedCoupons.set([]);
        mintedCoupons.set({});
        redeemedCoupons.set({});
    } catch (error) {
        // If logout fails, reload the page (window.solana.disconnect() might fail if user is not logged in)
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

    // Set token in store (fallback if cookies not allowed)
    token.set(loginToken);
}
