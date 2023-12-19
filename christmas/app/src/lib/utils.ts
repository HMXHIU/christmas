import { IPFS_HTTP_GATEWAY } from "./constants";
import {
    Coupon,
    CouponMetadata,
} from "../../../lib/anchor-client/anchorClient";

export function generateQRCodeURL(kwargs: Record<string, string>): string {
    const origin =
        (typeof window !== "undefined" ? window.location.origin : undefined) ||
        "https://${origin}";

    const queryParams: string[] = [];

    for (const key in kwargs) {
        if (kwargs.hasOwnProperty(key)) {
            queryParams.push(`${key}=${encodeURIComponent(kwargs[key])}`);
        }
    }

    return `${origin}?${queryParams.sort().join("&")}`;
}

export function extractQueryParams(url: string): Record<string, string> {
    return Object.fromEntries(new URL(url).searchParams.entries());
}

export function nft_uri_to_url(uri: string): string {
    // extract CID from uri
    const regex = /ipfs:\/\/(.+)/;
    const match = uri.match(regex);

    if (!(match && match[1])) {
        throw new Error("nft metadata uri must start with ipfs://");
    }

    return `https://${IPFS_HTTP_GATEWAY}/ipfs/${match[1]}`;
}

export async function getCouponMetadata(
    coupon: Coupon
): Promise<CouponMetadata> {
    const url = nft_uri_to_url(coupon.account.uri);
    const response = await fetch(url);
    return await response.json();
}
