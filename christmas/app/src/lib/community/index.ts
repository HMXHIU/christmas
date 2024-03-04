import { PublicKey, Transaction, type HttpHeaders } from "@solana/web3.js";
import {
    type Account,
    type Coupon,
    type Store,
    type TransactionResult,
    type User,
} from "../anchorClient/types";

import { PUBLIC_HOST } from "$env/static/public";
import { logout as logoutCrossoover } from "$lib/crossover";
import type { CreateStoreSchema } from "$lib/server/community/router";
import { trpc } from "$lib/trpcClient";
import { signAndSendTransaction } from "$lib/utils";
import type { HTTPHeaders } from "@trpc/client";
import { get } from "svelte/store";
import type { z } from "zod";
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
    userDeviceClient,
    userMetadata,
} from "../../store";
import { COUPON_NAME_SIZE, STRING_PREFIX_SIZE } from "../anchorClient/defs";
import { stringToUint8Array } from "../utils";
import type {
    CouponMetadata,
    CreateCouponParams,
    StoreMetadata,
    UserMetadata,
} from "./types";
import {
    cleanCouponBalance,
    cleanCouponSupplyBalance,
    cleanUser,
    deserializeStoreAccount,
} from "./utils";

// Exports
export {
    claimCoupon,
    createCoupon,
    createStore,
    createUser,
    fetchClaimedCoupons,
    fetchCouponMetadata,
    fetchMarketCoupons,
    fetchMintedCouponSupplyBalance,
    fetchStoreMetadata,
    fetchStores,
    fetchUser,
    fetchUserMetadata,
    login,
    logout,
    mintCoupon,
    redeemCoupon,
    refresh,
    verifyRedemption,
};

async function fetchMarketCoupons(
    {
        region,
        geohash,
    }: {
        region: number[] | string;
        geohash: number[] | string;
    },
    headers: HeadersInit = {},
): Promise<[Account<Coupon>, number][]> {
    const dc = get(userDeviceClient);

    region =
        typeof region === "string" ? region : String.fromCharCode(...region);

    geohash =
        typeof geohash === "string" ? geohash : String.fromCharCode(...geohash);

    const coupons = (
        await fetch(
            `${PUBLIC_HOST || ""}/api/community/coupon/market?region=${region}&geohash=${geohash}`,
            { headers },
        ).then(async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
        })
    ).map(cleanCouponBalance);

    // Update `$marketCoupons`
    marketCoupons.update(() => coupons);
    return coupons;
}

async function fetchCouponMetadata(
    coupon: Account<Coupon>,
    headers: HeadersInit = {},
): Promise<CouponMetadata> {
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
    headers: HeadersInit = {},
): Promise<[Account<Coupon>, number, number][]> {
    store = store instanceof PublicKey ? store.toBase58() : store;

    const couponsSupplyBalance = await fetch(
        `${PUBLIC_HOST || ""}/api/community/coupon/minted?store=${store}`,
        { headers },
    ).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }

        return (await response.json()).map(cleanCouponSupplyBalance);
    });

    // Update `$mintedCoupons`
    mintedCoupons.update((d) => {
        d[store as string] = couponsSupplyBalance;
        return d;
    });

    return couponsSupplyBalance;
}

async function fetchClaimedCoupons(
    headers: HeadersInit = {},
): Promise<[Account<Coupon>, number][]> {
    const coupons = await fetch(
        `${PUBLIC_HOST || ""}/api/community/coupon/claimed`,
        { headers },
    ).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return (await response.json()).map(cleanCouponBalance);
    });

    // Update `$claimedCoupons`
    claimedCoupons.set(coupons);

    return coupons;
}

async function claimCoupon(
    {
        coupon,
        numTokens,
    }: {
        coupon: Account<Coupon>;
        numTokens: number;
    },
    options?: { headers?: HeadersInit; wallet?: any },
): Promise<TransactionResult> {
    return await fetch(`${PUBLIC_HOST || ""}/api/community/coupon/claim`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
        body: JSON.stringify({
            numTokens,
            mint: coupon.account.mint.toString(),
        }),
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
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
    {
        coupon,
        numTokens,
    }: {
        coupon: Account<Coupon>;
        numTokens: number;
    },
    options?: { headers?: HeadersInit; wallet?: any },
): Promise<TransactionResult> {
    return await fetch(`${PUBLIC_HOST || ""}/api/community/coupon/redeem`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
        body: JSON.stringify({
            coupon: coupon.publicKey.toString(),
            numTokens,
            mint: coupon.account.mint.toString(),
        }),
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
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
    options?: { headers?: HeadersInit; wallet?: any },
): Promise<TransactionResult> {
    // Create form data with metadata and image
    const formData = new FormData();

    formData.set(
        "body",
        JSON.stringify({
            name: name.slice(0, COUPON_NAME_SIZE - STRING_PREFIX_SIZE), // also enforced in form
            description,
            validFrom,
            validTo,
            store: store.publicKey.toString(),
            geohash: store.account.geohash,
            region: store.account.region,
        }),
    );

    if (image != null) {
        formData.set("image", image);
    }

    // Create coupon
    return await fetch(`${PUBLIC_HOST || ""}/api/community/coupon/create`, {
        method: "POST",
        headers: options?.headers || {},
        body: formData,
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
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
    {
        coupon,
        numTokens,
    }: {
        coupon: Account<Coupon>;
        numTokens: number;
    },
    options?: { headers?: HeadersInit; wallet?: any },
): Promise<TransactionResult> {
    const couponPda =
        coupon.publicKey instanceof PublicKey
            ? coupon.publicKey.toBase58()
            : coupon.publicKey;

    return await fetch(`${PUBLIC_HOST || ""}/api/community/coupon/mint`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
        body: JSON.stringify({
            mint: coupon.account.mint,
            region: coupon.account.region,
            coupon: couponPda,
            numTokens,
        }),
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
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
        numTokens: string;
        wallet: string;
    },
    headers: HeadersInit = {},
): Promise<{ isVerified: boolean; err: string }> {
    return await fetch(`${PUBLIC_HOST || ""}/api/community/coupon/verify`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: JSON.stringify({
            signature,
            mint,
            wallet,
            numTokens,
        }),
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
        })
        .then(({ isVerified, err }) => {
            return { isVerified, err };
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
): Promise<StoreMetadata> {
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
    }: z.infer<typeof CreateStoreSchema>,
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

async function fetchUser(headers: HTTPHeaders = {}): Promise<User | null> {
    return await trpc({ headers })
        .community.user.user.query()
        .then((user) => {
            if (user == null) {
                return null;
            }
            return cleanUser(user);
        });
}

async function fetchUserMetadata(
    user: User,
    headers: HeadersInit = {},
): Promise<UserMetadata> {
    const fetchedUserMetadata = await fetch(user.uri, { headers }).then(
        async (response) => {
            if (!response.ok) {
                throw new Error(await response.text());
            }
            return response.json();
        },
    );

    // Update `$userMetadata`
    userMetadata.set(fetchedUserMetadata);

    return fetchedUserMetadata;
}

async function createUser(
    { region }: { region: number[] | string },
    options?: { headers?: HTTPHeaders; wallet?: any },
): Promise<TransactionResult> {
    region =
        typeof region === "string"
            ? Array.from(stringToUint8Array(region))
            : region;

    return await trpc({ headers: options?.headers || {} })
        .community.user.create.mutate({
            region,
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

async function refresh() {
    const { status, token: loginToken } =
        await trpc().community.auth.refresh.query();

    if (status !== "success" || loginToken == null) {
        throw new Error("Failed to refresh token");
    }

    // Set token in store (fallback if cookies not allowed)
    token.set(loginToken);
}
