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
    // extract CID from uri
    const regex = /ipfs:\/\/(.+)/;
    const match = uri.match(regex);

    if (!(match && match[1])) {
        console.warn(
            "failed to load image, nft metadata uri must start with ipfs://"
        );
        return "";
    }

    return `https://${IPFS_HTTP_GATEWAY}/ipfs/${match[1]}`;
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
    coupon: Account<Coupon>
): Promise<CouponMetadata> {
    const url = nft_uri_to_url(coupon.account.uri);
    const data = await fetchData(url, {});
    return { ...data, image: nft_uri_to_url(data.image || "") };
}

export async function getStoreMetadata(
    store: Account<Store>
): Promise<StoreMetadata> {
    const url = nft_uri_to_url(store.account.uri);
    const data = await fetchData(url, {});
    return { ...data, image: nft_uri_to_url(data.image || "") };
}
