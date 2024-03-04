import type { Account, Coupon, Store, User } from "$lib/anchorClient/types";
import { cleanString } from "$lib/utils";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";

export {
    cleanCouponAccount,
    cleanCouponBalance,
    cleanCouponSupplyBalance,
    cleanStore,
    cleanStoreAccount,
    cleanUser,
    deserializeCoupon,
    deserializeCouponAccount,
    deserializeCouponBalance,
    deserializeCouponSupplyBalance,
    deserializeStore,
    deserializeStoreAccount,
};

function cleanStore(store: Store) {
    store.name = cleanString(store.name);
    store.uri = cleanString(store.uri);
    return store;
}

function cleanStoreAccount(store: Account<Store>) {
    store.account = cleanStore(store.account);
    return store;
}

function cleanCouponAccount(coupon: Account<Coupon>) {
    coupon.account = {
        ...coupon.account,
        name: cleanString(coupon.account.name),
        uri: cleanString(coupon.account.uri),
    };
    return coupon;
}

function cleanCouponSupplyBalance(
    couponSupplyBalance: [Account<Coupon>, number, number],
) {
    couponSupplyBalance[0] = cleanCouponAccount(couponSupplyBalance[0]);
    return couponSupplyBalance;
}

function cleanCouponBalance(couponBalance: [Account<Coupon>, number]) {
    couponBalance[0] = cleanCouponAccount(couponBalance[0]);
    return couponBalance;
}

function cleanUser(user: User) {
    user.uri = cleanString(user.uri);
    return user;
}

function deserializeStore(store: any): Store {
    store.id = new BN(store.id, "hex");
    return store;
}

function deserializeStoreAccount(store: any): Account<Store> {
    store.account = deserializeStore(store.account);
    store.publicKey = new PublicKey(store.publicKey);
    return store;
}

function deserializeCoupon(coupon: any): Coupon {
    coupon.validFrom = new BN(coupon.validFrom, "hex");
    coupon.validTo = new BN(coupon.validTo, "hex");
    coupon.mint = new PublicKey(coupon.mint);
    return coupon;
}

function deserializeCouponAccount(coupon: any): Account<Coupon> {
    coupon.account = deserializeCoupon(coupon.account);
    coupon.publicKey = new PublicKey(coupon.publicKey);
    return coupon;
}

function deserializeCouponSupplyBalance(
    couponSupplyBalance: any,
): [Account<Coupon>, number, number] {
    couponSupplyBalance[0] = deserializeCouponAccount(couponSupplyBalance[0]);
    return couponSupplyBalance;
}

function deserializeCouponBalance(
    couponBalance: any,
): [Account<Coupon>, number] {
    couponBalance[0] = deserializeCouponAccount(couponBalance[0]);
    return couponBalance;
}
