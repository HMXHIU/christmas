export interface Location {
    geolocationCoordinates: GeolocationCoordinates | null;
    geohash: string | null;
    country: Country | null;
}

export interface Country {
    code: string;
    name: string;
}
