import { getCountriesForTimezone } from "countries-and-timezones";
import { COUNTRY_DETAILS, DEFAULT_GEOHASH_PRECISION } from "./defs";
import geohash from "ngeohash";
import { Location } from "./types";
import { stringToUint8Array } from "../anchor-client/utils";

export async function getLocation(
    geoHashPrecision?: number
): Promise<Location> {
    const geolocationCoordinates = await getGeolocationCoordinates();
    return {
        geolocationCoordinates,
        geohash: Array.from(
            stringToUint8Array(
                geohash.encode(
                    geolocationCoordinates.latitude,
                    geolocationCoordinates.longitude,
                    geoHashPrecision ?? DEFAULT_GEOHASH_PRECISION
                )
            )
        ),
        country: getCountry(),
    };
}

export async function getGeohash(precision?: number): Promise<number[]> {
    const { latitude, longitude } = await getGeolocationCoordinates();
    return Array.from(
        stringToUint8Array(
            geohash.encode(
                latitude,
                longitude,
                precision ?? DEFAULT_GEOHASH_PRECISION
            )
        )
    );
}

export async function getGeohashFromLatLng(
    latitude: number,
    longitude: number,
    precision?: number
): Promise<string> {
    return geohash.encode(
        latitude,
        longitude,
        precision ?? DEFAULT_GEOHASH_PRECISION
    );
}

export function getGeolocationCoordinates(): Promise<GeolocationCoordinates> {
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

export function getCountry(): { code: number[]; name: string } {
    const first = getCountriesForTimezone(getTimezone())[0];
    return {
        code: Array.from(
            stringToUint8Array(COUNTRY_DETAILS[first.id][0] || "USA")
        ),
        name: first.name,
    };
}
