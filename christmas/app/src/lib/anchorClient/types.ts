import type {
    AccountInfo,
    ParsedAccountData,
    PublicKey,
    SignatureResult,
    TransactionSignature,
} from "@solana/web3.js";
import type BN from "bn.js";

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
    region: number[];
    geohash: number[];
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
    region: number[];
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
    region: number[];
    geohash: number[];
    uri: string;
    owner: PublicKey;
    bump: number;
}

export interface User {
    region: number[];
    bump: number;
    uri: string;
}

export interface TransactionResult {
    result: SignatureResult;
    signature: TransactionSignature;
}

export interface Account<DataT> {
    publicKey: PublicKey | string;
    account: DataT;
}

export interface TokenAccount {
    pubkey: PublicKey; // note its pubkey not publicKey
    account: AccountInfo<Buffer | ParsedAccountData>;
}
