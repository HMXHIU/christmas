import { web3 } from "@coral-xyz/anchor";
import AnchorClient from "../../lib/anchorClient";
import { Coupon } from "@/types";

// TODO: Include ability to get coupons near geohash
export const fetchCoupons = async (
    anchorClient: AnchorClient,
    region: string
): Promise<Coupon[]> => {
    return anchorClient.getCoupons(region);
};

export const fetchClaimedCoupons = async (
    anchorClient: AnchorClient
): Promise<[Coupon, number][]> => {
    return anchorClient.getClaimedCoupons();
};

export interface CreateCoupon {
    // params for the metadata json (stored at uri)
    description: string;
    image: string;
    // params for creating and minting the coupon on chain
    geo: string;
    region: string;
    name: string;
    symbol: string;
    numTokens: number | undefined; // mint number of tokens to region market if provided
}

export const createCoupon = async (
    anchorClient: AnchorClient,
    { geo, region, name, symbol, numTokens, description, image }: CreateCoupon
): Promise<[web3.PublicKey, web3.PublicKey]> => {
    // TODO: store metadata json at uri
    const uri = "";
    const [mint, couponPda] = await anchorClient.createCoupon({
        geo,
        region,
        name,
        uri,
        symbol,
    });

    if (numTokens !== undefined) {
        await anchorClient.mintToMarket(mint, region, numTokens);
    }

    return [mint, couponPda];
};
