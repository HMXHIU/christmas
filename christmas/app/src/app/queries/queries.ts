import { web3 } from "@coral-xyz/anchor";
import AnchorClient from "../../lib/anchorClient";
import { Coupon } from "@/types";

// TODO: Include ability to get coupons near geohash
export async function fetchCoupons(
    anchorClient: AnchorClient,
    region: string
): Promise<Coupon[]> {
    return anchorClient.getCoupons(region);
}

export async function fetchClaimedCoupons(
    anchorClient: AnchorClient
): Promise<[Coupon, number][]> {
    return anchorClient.getClaimedCoupons();
}

export async function fetchMintedCoupons(
    anchorClient: AnchorClient
): Promise<[Coupon, number, number][]> {
    return anchorClient.getMintedCoupons();
}

export interface CreateCoupon {
    // params for the metadata json (stored at uri)
    description: string;
    image: string;
    // params for creating and minting the coupon on chain
    geo: string;
    region: string;
    name: string;
    symbol: string;
}

export async function createCoupon(
    anchorClient: AnchorClient,
    { geo, region, name, symbol, description, image }: CreateCoupon
) {
    // TODO: store metadata json at uri
    const uri = "";

    // create coupon
    await anchorClient.createCoupon({
        geo,
        region,
        name,
        uri,
        symbol,
    });
}

export interface MintCoupon {
    mint: web3.PublicKey;
    numTokens: number;
    region: string;
}

export async function mintCoupon(
    anchorClient: AnchorClient,
    { mint, numTokens, region }: MintCoupon
) {
    // note that coupons can only be minted to their respective regions
    await anchorClient.mintToMarket(mint, region, numTokens);
}

export interface RedeemCoupon {
    coupon: web3.PublicKey;
    mint: web3.PublicKey;
    numTokens: number;
}

export async function redeemCoupon(
    anchorClient: AnchorClient,
    { coupon, mint, numTokens }: RedeemCoupon
): Promise<web3.SignatureResult> {
    return await anchorClient.redeemCoupon({ coupon, mint, numTokens });
}
