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
} from "../store";
import { get } from "svelte/store";
import {
    generateQRCodeURL,
    getCouponMetadata,
    getStoreMetadata,
} from "./clients/utils";
import {
    COUPON_NAME_SIZE,
    STORE_NAME_SIZE,
    STRING_PREFIX_SIZE,
} from "./clients/anchor-client/defs";
import { stringToUint8Array } from "./clients/anchor-client/utils";

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

export async function fetchMarketCoupons(): Promise<
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

export async function fetchStoreMetadata(
    storePda: PublicKey,
): Promise<StoreMetadata> {
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

export async function fetchCouponMetadata(
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

export async function fetchMintedCouponSupplyBalance(
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

export async function fetchClaimedCoupons(): Promise<
    [Account<Coupon>, number][]
> {
    const ac = get(anchorClient);

    if (ac) {
        const coupons = await ac.getClaimedCoupons();
        // Update `$claimedCoupons`
        claimedCoupons.set(coupons);
        return coupons;
    }
    return [];
}

export async function fetchStores(): Promise<Account<Store>[]> {
    const ac = get(anchorClient);

    if (ac) {
        const clientStores = await ac.getStores();
        // Update `$stores`
        stores.set(clientStores);
        return clientStores;
    }
    return [];
}

export async function claimCoupon({
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
        const txResult = await payForTransaction({
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

export async function redeemCoupon({
    coupon,
    numTokens,
}: {
    coupon: Account<Coupon>;
    numTokens: number;
}): Promise<TransactionResult> {
    const ac = get(anchorClient);

    if (ac) {
        // Try to redeem for free
        const txResult = await payForTransaction({
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

export async function createStore({
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

export async function createCoupon({
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

export async function mintCoupon({
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

export async function verifyRedemption({
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

export async function createUser(): Promise<TransactionResult> {
    const ac = get(anchorClient);
    const dc = get(userDeviceClient);

    if (ac != null && dc?.location?.country?.code != null) {
        // Try to create user for free
        const txResult = await payForTransaction({
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

async function payForTransaction({
    procedure,
    parameters,
}: {
    procedure: string;
    parameters: any;
}): Promise<TransactionResult> {
    const ac = get(anchorClient);

    if (ac != null) {
        const url = generateQRCodeURL({}, "api/pay-for");

        return await fetch(url, {
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