import { z } from "zod";

export {
    CouponMetadataSchema,
    CouponSchema,
    CreateCouponSchema,
    CreateStoreSchema,
    MAX_COUPON_NAME_LENGTH,
    MAX_STORE_NAME_LENGTH,
    MemberMetadataSchema,
    MintCouponSchema,
    StoreMetadataSchema,
    type Coupon,
    type CouponAccount,
    type CouponMetadata,
    type CreateCoupon,
    type CreateStore,
    type MemberMetadata,
    type MintCoupon,
    type Store,
    type StoreMetadata,
    type TransactionResult,
    type TransactionSignature,
};

const MAX_STORE_NAME_LENGTH = 100;
const MAX_COUPON_NAME_LENGTH = 100;

const MemberMetadataSchema = z.object({
    region: z.string(),
});

type MemberMetadata = z.infer<typeof MemberMetadataSchema>;

const CouponSchema = z.object({
    coupon: z.string(),
    name: z.string().max(MAX_COUPON_NAME_LENGTH),
    uri: z.string(), // link to `CouponMetadata` (eg. image, description)
    region: z.string(),
    geohash: z.string(),
    store: z.string(),
    validFrom: z.coerce.date(),
    validTo: z.coerce.date(),
    owner: z.string(), // public key of the user who owns the store
});

type Coupon = z.infer<typeof CouponSchema>;

interface CouponAccount {
    account: string;
    coupon: string;
    supply: number;
    owner: string; // public key of the user who owns the store
}

interface Store {
    store: string;
    name: string;
    region: string;
    geohash: string;
    uri: string; // link to `StoreMetadata` (eg. image, description)
    owner: string; // public key of the user who owns the store
}

const CouponMetadataSchema = z.object({
    name: z.string(),
    description: z.string(),
    image: z.string(),
});

type CouponMetadata = z.infer<typeof CouponMetadataSchema>;

const StoreMetadataSchema = z.object({
    name: z.string(),
    description: z.string(),
    image: z.string(),
    address: z.string(),
    latitude: z.coerce.number(),
    longitude: z.coerce.number(),
});

type StoreMetadata = z.infer<typeof StoreMetadataSchema>;

// Create Entities Schemas

const CreateCouponSchema = z.object({
    name: z.string().min(1, "Coupon name is required"),
    description: z.string().min(1, "Coupon description is required"),
    region: z.string(),
    geohash: z.string(),
    store: z.string(),
    validFrom: z.coerce.date({
        required_error: "Coupon start date is required",
    }),
    validTo: z.coerce.date({
        required_error: "Coupon expiry date is required",
    }),
    image: z.string().min(1, "Coupon image is required"),
});

type CreateCoupon = z.infer<typeof CreateCouponSchema>;

const MintCouponSchema = z.object({
    region: z.string(),
    coupon: z.string(),
    numTokens: z.number().int().min(1).positive(),
});

type MintCoupon = z.infer<typeof MintCouponSchema>;

const CreateStoreSchema = z.object({
    name: z
        .string()
        .max(MAX_STORE_NAME_LENGTH)
        .min(1, "Store name is required"),
    description: z.string().min(1, "Store description is required"),
    region: z.string().min(1, "Region is required"),
    geohash: z.string().min(1, "Geohash is required"),
    latitude: z.coerce.number({ required_error: "Latitude is required" }),
    longitude: z.coerce.number({ required_error: "Longitude is required" }),
    address: z
        .string({
            required_error: "Store address is required",
            invalid_type_error: "Store address is required",
        })
        .min(1, "Store address is required"),
    image: z.string({
        required_error: "Store image is required",
        invalid_type_error: "Store image is required",
    }),
});

type CreateStore = z.infer<typeof CreateStoreSchema>;

// Transaction

type TransactionError = {} | string;

interface SignatureResult {
    err: TransactionError | null;
}
type TransactionSignature = string;

interface TransactionResult {
    result: SignatureResult;
    signature: TransactionSignature;
}
