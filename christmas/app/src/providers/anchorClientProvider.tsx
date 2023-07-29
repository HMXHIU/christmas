"use client";

import React, {
    useState,
    useEffect,
    useContext,
    createContext,
    FC,
    ReactNode,
} from "react";
import {
    useAnchorWallet,
    useWallet,
    useConnection,
} from "@solana/wallet-adapter-react";

import AnchorClient from "../lib/anchorClient";

const AnchorClientContext = createContext<AnchorClient | null>(null);

// needs to be within a WalletProvider
export const AnchorClientProvider: FC<{ children: ReactNode }> = ({
    children,
}) => {
    const { wallet, publicKey } = useWallet();
    const anchorWallet = useAnchorWallet();
    const { connection } = useConnection();
    const [anchorClient, setAnchorClient] = useState<AnchorClient | null>(null);

    useEffect(() => {
        if (anchorWallet && publicKey && connection) {
            setAnchorClient(new AnchorClient({ wallet: anchorWallet }));
        }
    }, [wallet, publicKey, connection, anchorWallet]);

    return (
        <AnchorClientContext.Provider value={anchorClient}>
            {children}
        </AnchorClientContext.Provider>
    );
};

export function useAnchorClient(): AnchorClient | null {
    return useContext(AnchorClientContext);
}
