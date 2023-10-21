"use client";

import React, {
    useState,
    useEffect,
    useContext,
    createContext,
    FC,
    ReactNode,
} from "react";

import geohash from "ngeohash";

import { getDeviceLocation, getUserCountry } from "../lib/utils";

export interface Country {
    code: string;
    name: string;
}

export interface ClientDevice {
    geolocationCoordinates: GeolocationCoordinates | null;
    geohash: string | null;
    country: Country | null;
}

const ClientDeviceContext = createContext<ClientDevice | null>(null);

/**
 * Provides information about the clients device (not to be confused with the user account)
 */
export const ClientDeviceProvider: FC<{
    children: ReactNode;
}> = ({ children }) => {
    const [clientDevice, setClientDevice] = useState<ClientDevice>({
        geolocationCoordinates: null,
        geohash: null,
        country: getUserCountry(),
    });

    useEffect(() => {
        getDeviceLocation().then((geolocationCoordinates) => {
            setClientDevice({
                ...clientDevice,
                geolocationCoordinates,
                geohash: geohash.encode(
                    geolocationCoordinates.latitude,
                    geolocationCoordinates.longitude,
                    6
                ),
            });
        });
    }, []);

    return (
        <ClientDeviceContext.Provider value={clientDevice}>
            {children}
        </ClientDeviceContext.Provider>
    );
};

export function useClientDevice(): ClientDevice | null {
    return useContext(ClientDeviceContext);
}
