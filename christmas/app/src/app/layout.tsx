import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import WalletProvider from "../providers/WalletProvider";

const inter = Inter({ subsets: ["latin"] });

// requires SSR
// export const metadata: Metadata = {
//     title: "Christmas Protocol",
//     description: "Christmas Protocol",
// };

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <WalletProvider>{children}</WalletProvider>
            </body>
        </html>
    );
}
