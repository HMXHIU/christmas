import type { Account, Coupon } from "$lib/anchorClient/types";

export interface ClaimCouponParams {
    numTokens: number;
    coupon: Account<Coupon>;
}

export interface RedeemCouponParams {
    numTokens: number;
    coupon: Account<Coupon>;
}
