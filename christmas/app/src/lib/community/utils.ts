import type { Account, Coupon, Store, User } from "$lib/anchorClient/types";
import { cleanString } from "$lib/utils";
import { BN } from "bn.js";

export {
    cleanCouponAccount,
    cleanCouponBalance,
    cleanCouponSupplyBalance,
    cleanStore,
    cleanStoreAccount,
    cleanUser,
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
        validFrom: new BN(coupon.account.validFrom, "hex"),
        validTo: new BN(coupon.account.validTo, "hex"),
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
    return store;
}
