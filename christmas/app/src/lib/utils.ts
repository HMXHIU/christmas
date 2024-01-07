import { IPFS_HTTP_GATEWAY } from "./constants";
import {
    Account,
    Coupon,
    CouponMetadata,
    Store,
    StoreMetadata,
} from "../../../lib/anchor-client/types";

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
    // Replace with gateway for IPFS
    const regex = /ipfs:\/\/(.+)/;
    const match = uri.match(regex);
    if (match && match[1]) {
        return `https://${IPFS_HTTP_GATEWAY}/ipfs/${match[1]}`;
    }
    return uri;
}

export function fetchData(url: string, defaultValue: any = {}): Promise<any> {
    return fetch(url)
        .then((res) => {
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }
            return res.json();
        })
        .catch((error) => {
            console.warn("Error fetching data:", error);
            return defaultValue; // Return the specified default value on error
        });
}

export async function getCouponMetadata(
    coupon: Coupon
): Promise<CouponMetadata> {
    const url = nft_uri_to_url(coupon.uri);
    const data = await fetchData(url, {});
    return { ...data, image: nft_uri_to_url(data.image || "") };
}

export async function getStoreMetadata(store: Store): Promise<StoreMetadata> {
    const url = nft_uri_to_url(store.uri);
    const data = await fetchData(url, {});
    return { ...data, image: nft_uri_to_url(data.image || "") };
}
