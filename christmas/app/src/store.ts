import { writable } from "svelte/store";
import type { Coupon, Account, Store } from "$lib/anchorClient/types";

import { UserDeviceClient } from "$lib/clients/user-device-client/userDeviceClient";
import type {
    CouponMetadata,
    StoreMetadata,
    UserMetadata,
} from "$lib/community/types";

export let token = writable<string | null>(null); // jwt access token (cookies fallback, null if logged out)
export let userDeviceClient = writable<UserDeviceClient | null>(null);
export let marketCoupons = writable<[Account<Coupon>, number][]>([]);
export let claimedCoupons = writable<[Account<Coupon>, number][]>([]);
export let redeemedCoupons = writable<Record<string, string>>({});
export let stores = writable<Account<Store>[]>([]);
export let storesMetadata = writable<Record<string, StoreMetadata>>({});
export let mintedCoupons = writable<
    Record<string, [Account<Coupon>, number, number][]>
>({});
export let couponsMetadata = writable<Record<string, CouponMetadata>>({});
export let userMetadata = writable<Record<string, UserMetadata>>({});
