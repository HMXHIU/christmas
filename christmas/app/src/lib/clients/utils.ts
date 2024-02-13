import BN from "bn.js";

import type {
    Coupon,
    CouponMetadata,
    Store,
    StoreMetadata,
} from "./anchor-client/types";
import { cleanString } from "./anchor-client/utils";

const PUBLIC_IPFS_HTTP_GATEWAY = "ipfs.io";

export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 6371; // Earth's radius in kilometers

    // Convert latitudes from degrees to radians
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const lon1Rad = (lon1 * Math.PI) / 180;
    const lon2Rad = (lon2 * Math.PI) / 180;

    const x = (lon2Rad - lon1Rad) * Math.cos((lat1Rad + lat2Rad) / 2);
    const y = lat2Rad - lat1Rad;

    // Distance using Equirectangular approximation
    const distance = Math.sqrt(x * x + y * y) * R;

    return distance;
}

export function timeStampToDate(timeStamp: BN): Date {
    return new Date(timeStamp.toNumber());
}

export function generateQRCodeURL(
    kwargs: Record<string, string>,
    uri?: string,
): string {
    const origin =
        (typeof window !== "undefined" ? window.location.origin : undefined) ||
        "https://${origin}";

    const queryParams: string[] = [];

    for (const key in kwargs) {
        if (kwargs.hasOwnProperty(key)) {
            queryParams.push(`${key}=${encodeURIComponent(kwargs[key])}`);
        }
    }
    const url = uri ? new URL(uri, origin) : origin;

    return `${url}?${queryParams.sort().join("&")}`;
}

export function extractQueryParams(url: string): Record<string, string> {
    return Object.fromEntries(new URL(url).searchParams.entries());
}

export function nft_uri_to_url(uri: string): string {
    // Replace with gateway for IPFS
    const regex = /ipfs:\/\/(.+)/;
    const match = uri.match(regex);
    if (match && match[1]) {
        return `https://${PUBLIC_IPFS_HTTP_GATEWAY}/ipfs/${match[1]}`;
    }
    return uri;
}

export function fetchData(url: string, defaultValue: any = {}): Promise<any> {
    if (url) {
        return fetch(url)
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! Status: ${res.status}`);
                }
                return res.json();
            })
            .catch((error) => {
                console.warn(`Could not fetch ${url}`);
                return defaultValue; // Return the specified default value on error
            });
    }
    return defaultValue;
}

export async function getCouponMetadata(
    coupon: Coupon,
): Promise<CouponMetadata> {
    const url = nft_uri_to_url(cleanString(coupon.uri));
    const data = await fetchData(url, {});
    return { ...data, image: nft_uri_to_url(data.image || "") };
}

export async function getStoreMetadata(store: Store): Promise<StoreMetadata> {
    const url = nft_uri_to_url(cleanString(store.uri));
    const data = await fetchData(url, {});
    return { ...data, image: nft_uri_to_url(data.image || "") };
}
