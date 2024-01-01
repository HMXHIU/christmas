import { getCountriesForTimezone } from "countries-and-timezones";
import { COUNTRY_DETAILS } from "./defs";
import geohash from "ngeohash";
import { Location } from "./types";

export async function getLocation(): Promise<Location> {
    const geolocationCoordinates = await getGeolocationCoordinates();
    return {
        geolocationCoordinates,
        geohash: geohash.encode(
            geolocationCoordinates.latitude,
            geolocationCoordinates.longitude,
            6
        ),
        country: getCountry(),
    };
}

export async function getGeohash(): Promise<string> {
    const { latitude, longitude } = await getGeolocationCoordinates();
    return geohash.encode(latitude, longitude, 6);
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

export function getCountry(): { code: string; name: string } {
    const first = getCountriesForTimezone(getTimezone())[0];
    return {
        code: COUNTRY_DETAILS[first.id][0] || "USA",
        name: first.name,
    };
}
