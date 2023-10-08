"use client";

import React, {
    useState,
    useEffect,
    useContext,
    createContext,
    FC,
    ReactNode,
} from "react";
import NFTStorageClient from "../lib/nftStorageClient";

const NftStorageClientContext = createContext<NFTStorageClient | null>(null);

/**
 * Provider returning a client from https://nft.storage
 */
export const NftStorageClientProvider: FC<{
    children: ReactNode;
    token: string;
}> = ({ children, token }) => {
    const [nftStorageClient, setNftStorageClient] =
        useState<NFTStorageClient | null>(null);

    useEffect(() => {
        setNftStorageClient(
            new NFTStorageClient({
                token: token,
            })
        );
    }, []);

    return (
        <NftStorageClientContext.Provider value={nftStorageClient}>
            {children}
        </NftStorageClientContext.Provider>
    );
};

export function useNftStorageClient(): NFTStorageClient | null {
    return useContext(NftStorageClientContext);
}
