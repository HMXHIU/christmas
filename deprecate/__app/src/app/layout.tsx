import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import WalletProvider from "../providers/walletProvider";
import QueryProvider from "../providers/queryProvider";
import NavBottom from "./components/navBottom";
import NavTop from "./components/navTop";
import { AnchorClientProvider } from "@/providers/anchorClientProvider";
import { NftStorageClientProvider } from "@/providers/nftStorageClientProvider";
import { ClientDeviceProvider } from "@/providers/clientDeviceProvider";

import { NFT_STORAGE_TOKEN } from "../lib/constants";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Christmas Protocol",
    description: "Christmas Protocol",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <WalletProvider>
                    <AnchorClientProvider>
                        <NftStorageClientProvider token={NFT_STORAGE_TOKEN}>
                            <ClientDeviceProvider>
                                <div className="flex flex-col min-h-screen">
                                    <NavTop />
                                    <div className="flex-grow px-4 py-16 pt-16">
                                        <QueryProvider>
                                            {children}
                                        </QueryProvider>
                                    </div>
                                    <NavBottom />
                                </div>
                            </ClientDeviceProvider>
                        </NftStorageClientProvider>
                    </AnchorClientProvider>
                </WalletProvider>
            </body>
        </html>
    );
}
