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

export let token = writable<string | null>(null); // jwt access token (cookies fallback, null if logged out)
export let anchorClient = writable<AnchorClient | null>(null);
export let userDeviceClient = writable<UserDeviceClient | null>(null);
export let marketCoupons = writable<[Account<Coupon>, TokenAccount][]>([]);
export let claimedCoupons = writable<[Account<Coupon>, number][]>([]);
export let redeemedCoupons = writable<Record<string, string>>({});
export let stores = writable<Account<Store>[]>([]);
export let storesMetadata = writable<Record<string, StoreMetadata>>({});
export let mintedCoupons = writable<
    Record<string, [Account<Coupon>, number, number][]>
>({});
export let couponsMetadata = writable<Record<string, CouponMetadata>>({});
