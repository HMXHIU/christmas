export const DISCRIMINATOR_SIZE = 8;
export const PUBKEY_SIZE = 32;
export const U8_SIZE = 1;
export const U64_SIZE = 8;
export const BOOL_SIZE = 1;
export const STRING_PREFIX_SIZE = 4;
export const BUMP_SIZE = 1;
export const GEO_SIZE = STRING_PREFIX_SIZE + 6; // 6 characters of resolution
export const TWO_FACTOR_SIZE = U8_SIZE * 32; // 256 bit
export const REGION_SIZE = STRING_PREFIX_SIZE + 3; // 3 digit country code
export const COUPON_NAME_SIZE = STRING_PREFIX_SIZE + 36;
export const COUPON_SYMBOL_SIZE = STRING_PREFIX_SIZE + 14;
export const STORE_NAME_SIZE = STRING_PREFIX_SIZE + 36;
export const URI_SIZE = STRING_PREFIX_SIZE + 204;

export const USER_ACCOUNT_SIZE =
    DISCRIMINATOR_SIZE + TWO_FACTOR_SIZE + REGION_SIZE + GEO_SIZE + BUMP_SIZE;

export const COUPON_METADATA_SIZE =
    DISCRIMINATOR_SIZE +
    PUBKEY_SIZE +
    PUBKEY_SIZE +
    COUPON_NAME_SIZE +
    COUPON_SYMBOL_SIZE +
    URI_SIZE +
    REGION_SIZE +
    GEO_SIZE +
    BUMP_SIZE;
