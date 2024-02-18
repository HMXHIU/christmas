import type { Account, Store, User } from "$lib/anchorClient/types";
import type { Coupon } from "$lib/anchorClient/types";
import { cleanString } from "$lib/utils";
import { BN } from "bn.js";

export {
    cleanStoreAccount,
    cleanCouponAccount,
    cleanUser,
    cleanCouponSupplyBalance,
    cleanCouponBalance,
};

function cleanStoreAccount(store: Account<Store>) {
    store.account = {
        ...store.account,
        name: cleanString(store.account.name),
        uri: cleanString(store.account.uri),
    };
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
