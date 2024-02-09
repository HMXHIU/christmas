import type {
    SignatureResult,
    TransactionSignature,
    PublicKey,
    ParsedAccountData,
    AccountInfo,
} from "@solana/web3.js";
import BN from "bn.js";
import yup from "yup";

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

export const UserMetadataSchema = yup.object().shape({
    publicKey: yup.string().required(),
});

export type UserMetadata = yup.InferType<typeof UserMetadataSchema>;

export interface User {
    region: number[];
    bump: number;
}

export interface TransactionResult {
    result: SignatureResult;
    signature: TransactionSignature;
}

export const CouponMetadataSchema = yup.object().shape({
    name: yup.string().required(),
    description: yup.string().required(),
    image: yup.string().required(),
});

export type CouponMetadata = yup.InferType<typeof CouponMetadataSchema>;

export const StoreMetadataSchema = yup.object().shape({
    name: yup.string().required(),
    description: yup.string().required(),
    image: yup.string().required(),
    address: yup.string().required(),
    latitude: yup.number().required(),
    longitude: yup.number().required(),
});

export type StoreMetadata = yup.InferType<typeof StoreMetadataSchema>;

export interface Account<DataT> {
    publicKey: PublicKey;
    account: DataT;
}

export interface TokenAccount {
    pubkey: PublicKey; // note its pubkey not publicKey
    account: AccountInfo<Buffer | ParsedAccountData>;
}
