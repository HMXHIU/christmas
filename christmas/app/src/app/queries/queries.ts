import { web3 } from "@coral-xyz/anchor";
import AnchorClient from "../../lib/anchorClient";
import NFTStorageClient from "@/lib/nftStorageClient";
import { Coupon, TransactionResult, CouponMetadata } from "@/types";
import { nft_uri_to_url } from "@/lib/utils";

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

export async function fetchCouponMetadata(
    coupon: Coupon
): Promise<CouponMetadata> {
    const url = nft_uri_to_url(coupon.account.uri);
    const response = await fetch(url);
    return await response.json();
}

export async function fetchMintedCoupons(
    anchorClient: AnchorClient
): Promise<[Coupon, number, number][]> {
    return anchorClient.getMintedCoupons();
}

export interface CreateCoupon {
    // params for the metadata json (stored at uri)
    description: string;
    image: File | null;
    // params for creating and minting the coupon on chain
    geo: string;
    region: string;
    name: string;
    symbol: string;
    uri: string;
}

export async function createCoupon(
    anchorClient: AnchorClient,
    nftStorageClient: NFTStorageClient,
    { geo, region, name, symbol, description, image }: CreateCoupon
): Promise<TransactionResult> {
    // upload the metadata to nft storage
    let metadataUrl = "";
    if (image) {
        metadataUrl = await nftStorageClient.store({
            name: name,
            description: description,
            imageFile: image,
        });
        console.log(`Uploaded metadata to ${metadataUrl}`);
    }

    return await anchorClient.createCoupon({
        geo,
        region,
        name,
        symbol,
        uri: metadataUrl,
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
): Promise<TransactionResult> {
    // note that coupons can only be minted to their respective regions
    return await anchorClient.mintToMarket(mint, region, numTokens);
}

export interface RedeemCoupon {
    coupon: web3.PublicKey;
    mint: web3.PublicKey;
    numTokens: number;
}

export async function redeemCoupon(
    anchorClient: AnchorClient,
    { coupon, mint, numTokens }: RedeemCoupon
): Promise<TransactionResult> {
    return await anchorClient.redeemCoupon({ coupon, mint, numTokens });
}
