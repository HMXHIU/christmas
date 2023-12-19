"use client";

import dynamic from "next/dynamic";

import { useWallet } from "@solana/wallet-adapter-react";

// import dynamically to avoid SSR hydration issues
const WalletMultiButton = dynamic(
    async () =>
        (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
    { ssr: false }
);

// import dynamically to avoid SSR hydration issues
const WalletDisconnectButton = dynamic(
    async () =>
        (await import("@solana/wallet-adapter-react-ui"))
            .WalletDisconnectButton,
    { ssr: false }
);

export default () => {
    const { connected } = useWallet();

    return (
        <nav className="bg-gray-900 text-white py-4 px-6 flex justify-end items-center fixed top-0 left-0 right-0">
            <div>
                {connected ? (
                    <WalletDisconnectButton className="text-white hover:text-gray-300" />
                ) : (
                    <WalletMultiButton className="text-white hover:text-gray-300" />
                )}
            </div>
        </nav>
    );
};
