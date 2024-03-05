import type { Account, Coupon, Store } from "$lib/anchorClient/types";

export interface MintCouponParams {
    coupon: Account<Coupon>;
    numTokens: number;
}

export interface CreateCouponParams {
    name: string;
    description: string;
    validFrom: Date;
    validTo: Date;
    image: string;
    store: Account<Store>;
}

export interface ClaimCouponParams {
    numTokens: number;
    coupon: Account<Coupon>;
}

export interface RedeemCouponParams {
    numTokens: number;
    coupon: Account<Coupon>;
}
