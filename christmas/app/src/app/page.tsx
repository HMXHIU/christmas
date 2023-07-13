"use client";

import Image from "next/image";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";

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

export default function Home() {
    const { connected } = useWallet();

    return (
        <div className="flex flex-col min-h-screen">
            <nav className="bg-gray-900 text-white py-4 px-6 flex justify-end">
                <div>
                    {connected ? (
                        <WalletDisconnectButton className="text-white hover:text-gray-300" />
                    ) : (
                        <WalletMultiButton className="text-white hover:text-gray-300" />
                    )}
                </div>
            </nav>

            <main className="flex flex-grow items-center justify-center">
                <div className="text-center">
                    <Image
                        src="/next.svg"
                        alt="Next.js Logo"
                        width={180}
                        height={37}
                        priority
                    />
                </div>
            </main>

            <nav className="bg-gray-900 text-white py-4 px-6 flex justify-between">
                <Link href="/marketplace" legacyBehavior>
                    <a className="flex flex-col items-center">
                        <img
                            src="/marketplace-icon.svg"
                            alt="Marketplace"
                            className="w-6 h-6 mb-1"
                        />
                        <span>Marketplace</span>
                    </a>
                </Link>
                <Link href="/my-coupons" legacyBehavior>
                    <a className="flex flex-col items-center">
                        <img
                            src="/my-coupons-icon.svg"
                            alt="My Coupons"
                            className="w-6 h-6 mb-1"
                        />
                        <span>My Coupons</span>
                    </a>
                </Link>
                <Link href="/mint-coupons" legacyBehavior>
                    <a className="flex flex-col items-center">
                        <img
                            src="/mint-coupons-icon.svg"
                            alt="Mint Coupons"
                            className="w-6 h-6 mb-1"
                        />
                        <span>Mint Coupons</span>
                    </a>
                </Link>
            </nav>
        </div>
    );
}
