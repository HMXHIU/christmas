import {
    SignatureResult,
    TransactionSignature,
    PublicKey,
    ParsedAccountData,
    AccountInfo,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export interface MemCmp {
    memcmp: {
        offset: number;
        bytes: string;
    };
}

export interface Coupon {
    updateAuthority: PublicKey;
    mint: PublicKey;
    name: string;
    uri: string;
    region: string;
    geo: string;
    store: PublicKey;
    validFrom: BN;
    validTo: BN;
    validFromHash: number[];
    validToHash: number[];
    datehashOverflow: boolean;
    hasSupply: boolean;
    supply: number;
    bump: number;
}

export interface RegionMarket {
    region: string;
    bump: number;
}

export interface ProgramState {
    isInitialized: boolean;
    bump: number;
    storeCounter: BN; // anchor returns u64 as BN
}

export interface Store {
    name: string;
    id: BN;
    region: string;
    geo: string;
    uri: string;
    owner: PublicKey;
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

export interface StoreMetadata {
    name: string;
    description: string;
    image: string;
    address: string;
    latitude: number;
    longitude: number;
}

export interface Account<DataT> {
    publicKey: PublicKey;
    account: DataT;
}

export interface TokenAccount {
    pubkey: PublicKey; // note its pubkey not publicKey
    account: AccountInfo<Buffer | ParsedAccountData>;
}
