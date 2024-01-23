export const PROGRAM_ID = "B2ejsK7m3eYPerru92hS73Gx7sQ7J83DKoLHGwn6pg5v";

export const DISCRIMINATOR_SIZE = 8;
export const PUBKEY_SIZE = 32;
export const U8_SIZE = 1;
export const U16_SIZE = 2;
export const U32_SIZE = 4;
export const U64_SIZE = 8;
export const BOOL_SIZE = 1;
export const STRING_PREFIX_SIZE = 4;
export const BUMP_SIZE = 1;
export const GEOHASH_SIZE = 6; // 6 characters of resolution
export const TWO_FACTOR_SIZE = U8_SIZE * 32; // 256 bit
export const REGION_SIZE = 3; // 3 digit country code
export const COUPON_NAME_SIZE = STRING_PREFIX_SIZE + 36;
export const COUPON_SYMBOL_SIZE = STRING_PREFIX_SIZE + 14;
export const STORE_NAME_SIZE = STRING_PREFIX_SIZE + 36;
export const URI_SIZE = STRING_PREFIX_SIZE + 204;
export const DATE_SIZE = U64_SIZE;
export const DATE_HASH_SIZE = 32; // 32 * 8 = 256 days per epoch since 1 jan 2024
export const DATE_HASH_OVERFLOW_SIZE = BOOL_SIZE;
export const HAS_SUPPLY_SIZE = BOOL_SIZE;
export const SUPPLY_SIZE = U32_SIZE;
export const DAYS_SINCE_1_JAN_2024 = 19722; // Math.floor(new Date(2024, 0, 1).getTime() / MS_PER_DAY)
export const MS_PER_DAY = 1000 * 60 * 60 * 24;
export const DATE_HASH_BITS = DATE_HASH_SIZE * 8;

export const USER_ACCOUNT_SIZE =
    DISCRIMINATOR_SIZE + REGION_SIZE + GEOHASH_SIZE + BUMP_SIZE;

export const COUPON_ACCOUNT_SIZE =
    DISCRIMINATOR_SIZE +
    PUBKEY_SIZE + // update_authority
    PUBKEY_SIZE + // mint
    COUPON_NAME_SIZE +
    URI_SIZE +
    // convenience fields
    PUBKEY_SIZE + // store
    DATE_SIZE + // valid_from
    DATE_SIZE + // valid_to
    SUPPLY_SIZE +
    // memcmp block
    REGION_SIZE +
    GEOHASH_SIZE +
    HAS_SUPPLY_SIZE +
    DATE_HASH_SIZE + // valid_from_hash
    DATE_HASH_SIZE + // valid_to_hash
    DATE_HASH_OVERFLOW_SIZE +
    // bump
    BUMP_SIZE;

export const OFFSET_TO_STORE =
    DISCRIMINATOR_SIZE +
    PUBKEY_SIZE + // update_authority
    PUBKEY_SIZE + // mint
    COUPON_NAME_SIZE +
    URI_SIZE;

export const OFFSET_TO_MEMCMP_BLOCK =
    DISCRIMINATOR_SIZE +
    PUBKEY_SIZE + // update_authority
    PUBKEY_SIZE + // mint
    COUPON_NAME_SIZE +
    URI_SIZE +
    // convenience fields
    PUBKEY_SIZE + // store
    DATE_SIZE + // valid_from
    DATE_SIZE + // valid_to
    SUPPLY_SIZE;

export const OFFSET_TO_VALID_FROM_HASH =
    DISCRIMINATOR_SIZE +
    PUBKEY_SIZE + // update_authority
    PUBKEY_SIZE + // mint
    COUPON_NAME_SIZE +
    URI_SIZE +
    // convenience fields
    PUBKEY_SIZE + // store
    DATE_SIZE + // valid_from
    DATE_SIZE + // valid_to
    SUPPLY_SIZE +
    // memcmp block
    REGION_SIZE +
    GEOHASH_SIZE +
    HAS_SUPPLY_SIZE;

export const OFFSET_TO_VALID_TO_HASH =
    DISCRIMINATOR_SIZE +
    PUBKEY_SIZE + // update_authority
    PUBKEY_SIZE + // mint
    COUPON_NAME_SIZE +
    URI_SIZE +
    // convenience fields
    PUBKEY_SIZE + // store
    DATE_SIZE + // valid_from
    DATE_SIZE + // valid_to
    SUPPLY_SIZE +
    // memcmp block
    REGION_SIZE +
    GEOHASH_SIZE +
    HAS_SUPPLY_SIZE +
    DATE_HASH_SIZE; // valid_from_hash

export const OFFSET_TO_REGION =
    DISCRIMINATOR_SIZE +
    PUBKEY_SIZE + // update_authority
    PUBKEY_SIZE + // mint
    COUPON_NAME_SIZE +
    URI_SIZE +
    // convenience fields
    PUBKEY_SIZE + // store
    DATE_SIZE + // valid_from
    DATE_SIZE + // valid_to
    SUPPLY_SIZE;

export const OFFSET_TO_HAS_SUPPLY =
    DISCRIMINATOR_SIZE +
    PUBKEY_SIZE + // update_authority
    PUBKEY_SIZE + // mint
    COUPON_NAME_SIZE +
    URI_SIZE +
    // convenience fields
    PUBKEY_SIZE + // store
    DATE_SIZE + // valid_from
    DATE_SIZE + // valid_to
    SUPPLY_SIZE +
    // memcmp block
    REGION_SIZE +
    GEOHASH_SIZE;

export const OFFSET_TO_DATE_HASH_OVERFLOW =
    DISCRIMINATOR_SIZE +
    PUBKEY_SIZE + // update_authority
    PUBKEY_SIZE + // mint
    COUPON_NAME_SIZE +
    URI_SIZE +
    // convenience fields
    PUBKEY_SIZE + // store
    DATE_SIZE + // valid_from
    DATE_SIZE + // valid_to
    SUPPLY_SIZE +
    // memcmp block
    REGION_SIZE +
    GEOHASH_SIZE +
    HAS_SUPPLY_SIZE +
    DATE_HASH_SIZE + // valid_from_hash
    DATE_HASH_SIZE;

export const OFFSET_TO_GEO =
    DISCRIMINATOR_SIZE +
    PUBKEY_SIZE + // update_authority
    PUBKEY_SIZE + // mint
    COUPON_NAME_SIZE +
    URI_SIZE +
    // convenience fields
    PUBKEY_SIZE + // store
    DATE_SIZE + // valid_from
    DATE_SIZE + // valid_to
    SUPPLY_SIZE +
    // memcmp block
    REGION_SIZE;
