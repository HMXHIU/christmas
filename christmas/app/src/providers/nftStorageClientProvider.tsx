"use client";

import React, {
    useState,
    useEffect,
    useContext,
    createContext,
    FC,
    ReactNode,
} from "react";
import { NFTStorage, File } from "nft.storage";

const NftStorageClientContext = createContext<NFTStorage | null>(null);

/**
 * Provider returning a client from https://nft.storage
 */
export const NftStorageClientProvider: FC<{
    children: ReactNode;
    token: string;
}> = ({ children, token }) => {
    const [nftStorageClient, setNftStorageClient] = useState<NFTStorage | null>(
        null
    );

    useEffect(() => {
        setNftStorageClient(
            new NFTStorage({
                token: token,
            })
        );
    });

    return (
        <NftStorageClientContext.Provider value={nftStorageClient}>
            {children}
        </NftStorageClientContext.Provider>
    );
};

export function useNftStorageClient(): NFTStorage | null {
    return useContext(NftStorageClientContext);
}
