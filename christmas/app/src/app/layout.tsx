import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import WalletProvider from "../providers/walletProvider";
import QueryProvider from "../providers/queryProvider";
import NavBottom from "./components/navBottom";
import NavTop from "./components/navTop";

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
                    <div className="flex flex-col min-h-screen">
                        <NavTop />
                        <QueryProvider>{children}</QueryProvider>
                        <NavBottom />
                    </div>
                </WalletProvider>
            </body>
        </html>
    );
}
