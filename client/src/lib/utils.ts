import { getCountriesForTimezone } from "countries-and-timezones";
import { COUNTRY_DETAILS, IPFS_HTTP_GATEWAY } from "./constants";
import geohash from "ngeohash";
import { Coupon, CouponMetadata } from "./anchor/anchorClient";

export interface Country {
  code: string;
  name: string;
}

export interface ClientDevice {
  geolocationCoordinates: GeolocationCoordinates | null;
  geohash: string | null;
  country: Country | null;
}

export async function getClientDevice(): Promise<ClientDevice> {
  const geolocationCoordinates = await getDeviceLocation();
  return {
    geolocationCoordinates,
    geohash: geohash.encode(
      geolocationCoordinates.latitude,
      geolocationCoordinates.longitude,
      6
    ),
    country: getUserCountry(),
  };
}

export async function getUserGeohash(): Promise<string> {
  const { latitude, longitude } = await getDeviceLocation();
  return geohash.encode(latitude, longitude, 6);
}

export function getDeviceLocation(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(position.coords);
        },
        (error) => {
          reject(new Error("Failed to retrieve geolocation."));
        }
      );
    } else {
      reject(new Error("Geolocation is not supported by this browser."));
    }
  });
}

export function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getUserCountry(): { code: string; name: string } {
  const first = getCountriesForTimezone(getTimezone())[0];
  return {
    code: COUNTRY_DETAILS[first.id][0] || "USA",
    name: first.name,
  };
}

export function generateQRCodeURL(kwargs: Record<string, string>): string {
  const origin =
    (typeof window !== "undefined" ? window.location.origin : undefined) ||
    "https://${origin}";

  const queryParams = [];

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
