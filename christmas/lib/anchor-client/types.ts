import {
    SignatureResult,
    TransactionSignature,
    PublicKey,
    ParsedAccountData,
    AccountInfo,
} from "@solana/web3.js";

export interface Coupon {
    updateAuthority: PublicKey;
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    region: string;
    geo: string;
    bump: number;
}

export interface RegionMarket {
    region: string;
    bump: number;
}

export interface ProgramState {
    isInitialized: boolean;
    bump: number;
}

export interface Store {
    name: string;
    region: string;
    geo: string;
    uri: string;
    bump: number;
}

export interface User {
    region: string;
    geo: string;
    bump: number;
}

export interface TransactionResult {
    result: SignatureResult;
    signature: TransactionSignature;
}

export interface CouponMetadata {
    name: string;
    description: string;
    image: string;
}

export interface Account<DataT> {
    publicKey: PublicKey;
    account: DataT;
}

export interface TokenAccount {
    pubkey: PublicKey; // note its pubkey not publicKey
    account: AccountInfo<Buffer | ParsedAccountData>;
}
