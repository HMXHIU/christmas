import AnchorClient from "../../lib/anchorClient";
import { Coupon } from "@/types";

export const fetchCoupons = async (
    anchorClient: AnchorClient | null,
    region: string
): Promise<Coupon[]> => {
    return anchorClient !== null ? anchorClient.getCoupons(region) : [];
};
