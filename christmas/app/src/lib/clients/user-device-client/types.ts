export interface Location {
    geolocationCoordinates: GeolocationCoordinates | null;
    geohash: number[] | null;
    country: Country | null;
}

export interface Country {
    code: number[];
    name: string;
}
