import AnchorClient from "../../lib/anchorClient";
import { Coupon } from "@/types";

// TODO: Include ability to get coupons near geohash
export const fetchCoupons = async (
    anchorClient: AnchorClient | null,
    region: string
): Promise<Coupon[]> => {
    return anchorClient !== null ? anchorClient.getCoupons(region) : [];
};

export const fetchClaimedCoupons = async (
    anchorClient: AnchorClient | null
): Promise<[Coupon, number][]> => {
    return anchorClient !== null ? anchorClient.getClaimedCoupons() : [];
};
