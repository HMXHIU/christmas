import type { Coupon, CouponAccount, Store } from "$lib/community/types";
import { Schema, type Entity } from "redis-om";

export {
    CouponAccountEntitySchema,
    CouponEntitySchema,
    StoreEntitySchema,
    type CouponAccountEntity,
    type CouponEntity,
    type StoreEntity,
};

const CouponEntitySchema = new Schema("Coupon", {
    coupon: { type: "string" }, // coupon id
    region: { type: "string" }, // region
    geohash: { type: "string" }, // geohash
    store: { type: "string" }, // store id
    owner: { type: "string" }, // who created the coupon
});

const StoreEntitySchema = new Schema("Store", {
    store: { type: "string" }, // store id
    region: { type: "string" }, // region
    geohash: { type: "string" }, // geohash
    owner: { type: "string" }, // who owns the store
});

const CouponAccountEntitySchema = new Schema("CouponAccount", {
    account: { type: "string" }, // account id
    coupon: { type: "string" }, // coupon id
    supply: { type: "number" }, // store id
    owner: { type: "string" }, // who owns the coupon account (can be region market)
});

type CouponEntity = Coupon & Entity;
type StoreEntity = Store & Entity;
type CouponAccountEntity = CouponAccount & Entity;
