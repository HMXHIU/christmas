import { writable, readable } from "svelte/store";
import type { AnchorClient } from "$lib/clients/anchor-client/anchorClient";
import type {
    Coupon,
    Account,
    TokenAccount,
    Store,
    StoreMetadata,
    CouponMetadata,
} from "$lib/clients/anchor-client/types";
import { UserDeviceClient } from "$lib/clients/user-device-client/userDeviceClient";
import type { NFTClient } from "$lib/clients/nft-client/types";
import { NFTMinioClient } from "$lib/clients/nft-client/nftMinioClient";
import { NFTStorageClient } from "$lib/clients/nft-client/nftStorageClient";
import {
    PUBLIC_MINIO_ACCESS_KEY,
    PUBLIC_MINIO_SECRET_KEY,
    PUBLIC_MINIO_PORT,
    PUBLIC_MINIO_ENDPOINT,
    PUBLIC_MINIO_USE_SSL,
    PUBLIC_MINIO_BUCKET,
    PUBLIC_NFT_STORAGE_TOKEN,
} from "$env/static/public";
export let solana = writable<any | null>(null);
export let token = writable<string | null>(null); // jwt access token (if cookies not available)
export let anchorClient = writable<AnchorClient | null>(null);
export let userDeviceClient = writable<UserDeviceClient | null>(null);
export let nftClient = readable<NFTClient>(
    import.meta.env.DEV
        ? new NFTMinioClient({
              accessKey: PUBLIC_MINIO_ACCESS_KEY,
              secretKey: PUBLIC_MINIO_SECRET_KEY,
              port: parseInt(PUBLIC_MINIO_PORT),
              endPoint: PUBLIC_MINIO_ENDPOINT,
              useSSL: JSON.parse(PUBLIC_MINIO_USE_SSL),
              bucket: PUBLIC_MINIO_BUCKET,
          })
        : new NFTStorageClient({
              token: PUBLIC_NFT_STORAGE_TOKEN,
          }),
);
export let marketCoupons = writable<[Account<Coupon>, TokenAccount][]>([]);
export let claimedCoupons = writable<[Account<Coupon>, number][]>([]);
export let redeemedCoupons = writable<Record<string, string>>({});
export let stores = writable<Account<Store>[]>([]);
export let storesMetadata = writable<Record<string, StoreMetadata>>({});
export let mintedCoupons = writable<
    Record<string, [Account<Coupon>, number, number][]>
>({});
export let couponsMetadata = writable<Record<string, CouponMetadata>>({});
