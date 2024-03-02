import { PublicKey, Transaction } from "@solana/web3.js";
import {
    type Account,
    type Coupon,
    type Store,
    type TransactionResult,
    type User,
} from "../anchorClient/types";

import { PUBLIC_HOST } from "$env/static/public";
import { logout as logoutCrossoover } from "$lib/crossover";
import { trpc } from "$lib/trpcClient";
import { signAndSendTransaction } from "$lib/utils";
import { get } from "svelte/store";
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
import {
    COUPON_NAME_SIZE,
    STORE_NAME_SIZE,
    STRING_PREFIX_SIZE,
} from "../anchorClient/defs";
import { stringToUint8Array } from "../utils";
import type {
    CouponMetadata,
    CreateCouponParams,
    CreateStoreParams,
    CreateUserParams,
    StoreMetadata,
    UserMetadata,
} from "./types";
import {
    cleanCouponBalance,
    cleanCouponSupplyBalance,
    cleanStoreAccount,
    cleanUser,
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

async function fetchStoreMetadata(
    storePda: PublicKey | string,
    headers: HeadersInit = {},
): Promise<StoreMetadata> {
    if (storePda instanceof PublicKey) {
    }
    storePda = storePda instanceof PublicKey ? storePda.toBase58() : storePda;

    const storeMetadata = await fetch(
        `${PUBLIC_HOST || ""}/api/community/store/metadata?store=${storePda}`,
        { headers },
    ).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return response.json();
    });

    // Update `$storeMetadata`
    storesMetadata.update((d) => {
        d[storePda as string] = storeMetadata;
        return d;
    });

    return storeMetadata;
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

async function fetchStores(
    headers: HeadersInit = {},
): Promise<Account<Store>[]> {
    const userStores = await fetch(
        `${PUBLIC_HOST || ""}/api/community/store/user`,
        { headers },
    ).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return (await response.json()).map(cleanStoreAccount);
    });

    // Update `$stores`
    stores.set(userStores);

    return userStores;
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

async function createStore(
    {
        name,
        description,
        address,
        region,
        latitude,
        longitude,
        geohash,
        logo,
    }: CreateStoreParams,
    options?: { headers?: HeadersInit; wallet?: any },
): Promise<TransactionResult> {
    // Create form data with metadata and image
    const formData = new FormData();
    formData.set(
        "body",
        JSON.stringify({
            name: name.slice(0, STORE_NAME_SIZE - STRING_PREFIX_SIZE), // also enforced in the form
            geohash: Array.from(stringToUint8Array(geohash)),
            region: Array.from(stringToUint8Array(region)),
            description,
            latitude,
            longitude,
            address,
        }),
    );
    if (logo != null) {
        formData.set("image", logo);
    }

    // Create store
    return await fetch(`${PUBLIC_HOST || ""}/api/community/store/create`, {
        method: "POST",
        body: formData,
        headers: options?.headers || {},
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

async function fetchUser(headers: HeadersInit = {}): Promise<User | null> {
    return fetch(`${PUBLIC_HOST || ""}/api/community/user`, {
        headers,
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(await response.text());
        }
        return cleanUser(await response.json());
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
    { region }: CreateUserParams,
    options?: { headers?: HeadersInit; wallet?: any },
): Promise<TransactionResult> {
    return fetch(`${PUBLIC_HOST || ""}/api/community/user/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
        },
        body: JSON.stringify({
            region: Array.from(stringToUint8Array(region)),
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

async function login() {
    const solanaSignInInput = await trpc().community.auth.siws.query();

    // const solanaSignInInput = await (
    //     await fetch(`${PUBLIC_HOST || ""}/api/auth/siws`)
    // ).json();
    const solanaSignInOutput = await window.solana.signIn(solanaSignInInput);

    const { status, token: loginToken } =
        await trpc().community.auth.login.query({
            solanaSignInInput,
            solanaSignInOutput,
        });

    // const loginResult = await fetch(`${PUBLIC_HOST || ""}/api/auth/login`, {
    //     method: "POST",
    //     headers: {
    //         "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //         solanaSignInInput,
    //         solanaSignInOutput,
    //     }),
    // });

    // if (!loginResult.ok) {
    //     throw new Error(loginResult.statusText);
    // }

    // const { status, token: loginToken } = await loginResult.json();

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

    // const refreshTokenResult = await fetch(
    //     `${PUBLIC_HOST || ""}/api/auth/refresh`,
    //     {
    //         method: "POST",
    //     },
    // );
    // if (refreshTokenResult.ok) {
    //     const { token: loginToken } = await refreshTokenResult.json();

    //     // Set token in store (fallback if cookies not allowed)
    //     token.set(loginToken);
    //     console.log("Refreshed token");
    // } else {
    //     console.error(
    //         `Failed to refresh token: ${refreshTokenResult.statusText}`,
    //     );
    // }
}
