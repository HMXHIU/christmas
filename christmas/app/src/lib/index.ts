import { PublicKey, Transaction } from "@solana/web3.js";
import type {
    Account,
    Coupon,
    CouponMetadata,
    Store,
    StoreMetadata,
    TokenAccount,
    TransactionResult,
} from "./clients/anchor-client/types";
import {
    anchorClient,
    userDeviceClient,
    nftClient,
    marketCoupons,
    claimedCoupons,
    mintedCoupons,
    stores,
    storesMetadata,
    couponsMetadata,
    token,
    redeemedCoupons,
} from "../store";
import { get } from "svelte/store";
import { getCouponMetadata, getStoreMetadata } from "./clients/utils";
import {
    COUPON_NAME_SIZE,
    PROGRAM_ID,
    STORE_NAME_SIZE,
    STRING_PREFIX_SIZE,
} from "./clients/anchor-client/defs";
import { stringToUint8Array } from "./clients/anchor-client/utils";
import { AnchorClient } from "./clients/anchor-client/anchorClient";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { PUBLIC_RPC_ENDPOINT } from "$env/static/public";

// Exports
export {
    fetchMarketCoupons,
    fetchStoreMetadata,
    fetchCouponMetadata,
    fetchMintedCouponSupplyBalance,
    fetchClaimedCoupons,
    fetchStores,
    claimCoupon,
    redeemCoupon,
    createStore,
    createCoupon,
    mintCoupon,
    verifyRedemption,
    createUser,
    logIn,
    logOut,
    refresh,
};

export interface CreateStoreFormResult {
    name: string;
    description: string;
    address: string;
    region: string;
    latitude: number;
    longitude: number;
    geohash: string;
    logo: File | null;
}

export interface CreateCouponFormResult {
    name: string;
    description: string;
    validFrom: Date;
    validTo: Date;
    image: File | null;
}

async function fetchMarketCoupons(): Promise<
    [Account<Coupon>, TokenAccount][]
> {
    const ac = get(anchorClient);
    const dc = get(userDeviceClient);

    if (ac && dc?.location?.country?.code) {
        const coupons = await ac.getCoupons(dc.location.country.code);
        // Update `$ marketCoupons`
        marketCoupons.update(() => coupons);
        return coupons;
    }
    return [];
}

async function fetchStoreMetadata(storePda: PublicKey): Promise<StoreMetadata> {
    const ac = get(anchorClient);
    const store = await ac!.getStoreByPda(storePda);
    const storeMetadata = await getStoreMetadata(store!);

    // Update `$storeMetadata`
    storesMetadata.update((d) => {
        d[storePda.toString()] = storeMetadata;
        return d;
    });

    return storeMetadata;
}

async function fetchCouponMetadata(
    coupon: Account<Coupon>,
): Promise<CouponMetadata> {
    const couponMetadata = await getCouponMetadata(coupon.account);
    // Update `$couponMetadata`
    couponsMetadata.update((d) => {
        d[coupon.publicKey.toString()] = couponMetadata;
        return d;
    });

    return couponMetadata;
}

async function fetchMintedCouponSupplyBalance(
    store: Account<Store>,
): Promise<[Account<Coupon>, number, number][]> {
    const ac = get(anchorClient);
    if (ac) {
        const couponsSupplyBalance = await ac.getMintedCoupons(store.publicKey);

        // Update `$mintedCoupons`
        mintedCoupons.update((d) => {
            d[store.publicKey.toString()] = couponsSupplyBalance;
            return d;
        });

        return couponsSupplyBalance;
    }
    return [];
}

async function fetchClaimedCoupons(): Promise<[Account<Coupon>, number][]> {
    const ac = get(anchorClient);

    if (ac) {
        const coupons = await ac.getClaimedCoupons();
        // Update `$claimedCoupons`
        claimedCoupons.set(coupons);
        return coupons;
    }
    return [];
}

async function fetchStores(): Promise<Account<Store>[]> {
    const ac = get(anchorClient);

    if (ac) {
        const clientStores = await ac.getStores();
        // Update `$stores`
        stores.set(clientStores);
        return clientStores;
    }
    return [];
}

async function claimCoupon({
    coupon,
    numTokens,
}: {
    coupon: Account<Coupon>;
    numTokens: number;
}): Promise<TransactionResult> {
    const ac = get(anchorClient);
    const dc = get(userDeviceClient);

    if (ac && dc?.location?.country?.code) {
        // Try to claim for free
        const txResult = await _payForTransaction({
            procedure: "claimFromMarket",
            parameters: {
                wallet: ac!.anchorWallet.publicKey.toString(),
                mint: coupon.account.mint.toString(),
                numTokens,
            },
        });

        // Try paying for claim
        if (txResult.result.err != null) {
            console.log("Failed to claim for free, paying for claim...");
            return await ac.claimFromMarket({
                mint: coupon.account.mint,
                numTokens,
            });
        } else {
            return txResult;
        }
    }
    throw new Error(
        "Failed to claim coupon, ensure that location is enabled and wallet is connected",
    );
}

async function redeemCoupon({
    coupon,
    numTokens,
}: {
    coupon: Account<Coupon>;
    numTokens: number;
}): Promise<TransactionResult> {
    const ac = get(anchorClient);

    if (ac) {
        // Try to redeem for free
        const txResult = await _payForTransaction({
            procedure: "redeemCoupon",
            parameters: {
                coupon: coupon.publicKey.toString(),
                wallet: ac.anchorWallet.publicKey.toString(),
                mint: coupon.account.mint.toString(),
                numTokens,
            },
        });

        // Try to pay for redemption
        if (txResult.result.err != null) {
            console.log("Failed to redeem for free, paying for redemption...");
            return await ac.redeemCoupon({
                coupon: coupon.publicKey,
                mint: coupon.account.mint,
                numTokens,
            });
        } else {
            return txResult;
        }
    }

    throw new Error(
        "Failed to redeem coupon, ensure that location is enabled and wallet is connected",
    );
}

async function createStore({
    name,
    description,
    address,
    region,
    latitude,
    longitude,
    geohash,
    logo,
}: CreateStoreFormResult) {
    const ac = get(anchorClient);
    const nc = get(nftClient);

    if (ac != null && nc != null) {
        let metadataUrl = "";

        if (logo) {
            metadataUrl = await nc.store({
                name,
                description,
                imageFile: logo,
                additionalMetadata: {
                    address: address,
                    latitude: latitude,
                    longitude: longitude,
                },
            });
            console.log(`Uploaded store metadata to ${metadataUrl}`);
        }

        const tx = await ac.createStore({
            name: name.slice(0, STORE_NAME_SIZE - STRING_PREFIX_SIZE), // also enforced in the form
            geohash: Array.from(stringToUint8Array(geohash)),
            region: Array.from(stringToUint8Array(region)),
            uri: metadataUrl,
        });
    }
}

async function createCoupon({
    image,
    name,
    description,
    validFrom,
    validTo,
    store,
}: {
    image: File | null;
    name: string;
    description: string;
    validFrom: Date;
    validTo: Date;
    store: Account<Store>;
}) {
    const ac = get(anchorClient);
    const nc = get(nftClient);

    if (ac != null && nc != null) {
        let metadataUrl = "";

        // Upload coupon image to nft storage
        if (image || description) {
            metadataUrl = await nc.store({
                name,
                description,
                ...(image ? { imageFile: image } : {}),
            });
            console.log(`Uploaded coupon metadata to ${metadataUrl}`);
        }

        // Create coupon
        await ac.createCoupon({
            geohash: store.account.geohash,
            region: store.account.region,
            name: name.slice(0, COUPON_NAME_SIZE - STRING_PREFIX_SIZE), // also enforced in form
            store: store.publicKey,
            uri: metadataUrl,
            validFrom: validFrom,
            validTo: validTo,
        });
    }
}

async function mintCoupon({
    coupon,
    numTokens,
}: {
    numTokens: number;
    coupon: Account<Coupon>;
}) {
    const ac = get(anchorClient);

    if (ac != null) {
        await ac.mintToMarket({
            mint: coupon.account.mint,
            region: coupon.account.region,
            coupon: coupon.publicKey,
            numTokens,
        });
    }
}

async function verifyRedemption({
    signature,
    mint,
    numTokens,
    wallet,
}: {
    signature: string;
    mint: string;
    numTokens: string;
    wallet: string;
}): Promise<{ isVerified: boolean; err: string }> {
    const ac = get(anchorClient);

    if (ac != null) {
        return await ac.verifyRedemption({
            mint: new PublicKey(mint),
            wallet: new PublicKey(wallet),
            signature,
            numTokens: parseInt(numTokens),
        });
    }

    return { isVerified: false, err: "Log in to verify..." };
}

async function createUser(): Promise<TransactionResult> {
    const ac = get(anchorClient);
    const dc = get(userDeviceClient);

    if (ac != null && dc?.location?.country?.code != null) {
        // Try to create user for free
        const txResult = await _payForTransaction({
            procedure: "createUser",
            parameters: {
                wallet: ac.anchorWallet.publicKey.toString(),
                region: dc.location.country.code,
            },
        });

        // Try paying for user
        if (txResult.result.err != null) {
            console.log("Failed to create user for free, paying for user...");
            return await ac.createUser({
                region: dc.location.country.code,
            });
        }
    }
    throw new Error(
        "Failed to create user, ensure that location is enabled and wallet is connected",
    );
}

async function logIn() {
    const solanaSignInInput = await (await fetch("/api/auth/siws")).json();
    const solanaSignInOutput = await (window as any).phantom?.solana.signIn(
        solanaSignInInput,
    );
    const loginResult = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            solanaSignInInput,
            solanaSignInOutput,
        }),
    });

    if (!loginResult.ok) {
        throw new Error(loginResult.statusText);
    }

    const { status, token: loginToken } = await loginResult.json();

    if (status !== "success" || loginToken == null) {
        throw new Error("Failed to log in");
    }

    // Set token in store (fallback if cookies not allowed)
    token.set(loginToken);

    // Set anchor client
    anchorClient.set(
        new AnchorClient({
            programId: new PublicKey(PROGRAM_ID),
            anchorWallet: (window as any).solana as AnchorWallet,
            cluster: PUBLIC_RPC_ENDPOINT,
        }),
    );
}

async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    await (window as any).solana.disconnect();
    token.set(null);
    anchorClient.set(null);

    // clear all stores
    marketCoupons.set([]);
    claimedCoupons.set([]);
    mintedCoupons.set({});
    redeemedCoupons.set({});
}

async function refresh() {
    const refreshTokenResult = await fetch("/api/auth/refresh", {
        method: "POST",
    });
    if (refreshTokenResult.ok) {
        const { token: loginToken } = await refreshTokenResult.json();

        // Set token in store (fallback if cookies not allowed)
        token.set(loginToken);
        console.log("Refreshed token");
    } else {
        console.error(
            `Failed to refresh token: ${refreshTokenResult.statusText}`,
        );
    }
}

async function _payForTransaction({
    procedure,
    parameters,
}: {
    procedure: string;
    parameters: any;
}): Promise<TransactionResult> {
    const ac = get(anchorClient);

    if (ac != null) {
        return await fetch("/api/pay-for", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ procedure, parameters }),
        })
            .then((response) => response.json())
            .then(({ transaction }) => {
                return ac.signAndSendTransaction({
                    tx: Transaction.from(Buffer.from(transaction, "base64")),
                });
            });
    }
    throw new Error(
        "Failed to pay for transaction, ensure that wallet is connected",
    );
}
