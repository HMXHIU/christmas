import { PublicKey } from "@solana/web3.js";

declare global {
    interface Window {
        solana: any; // 👈️ turn off type checking
    }
}

export interface Coupon {
    publicKey: PublicKey;
    account: {
        updateAuthority: PublicKey;
        mint: PublicKey;
        name: string;
        symbol: string;
        uri: string;
        region: string;
        geo: string;
        bump: number;
    };
}

export interface User {
    region: string;
    geo: string;
    bump: number;
}
