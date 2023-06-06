pub const DISCRIMINATOR_SIZE: usize = 8;
pub const PUBKEY_SIZE: usize = 32;
pub const U8_SIZE: usize = 1;
pub const U64_SIZE: usize = 8;
pub const BOOL_SIZE: usize = 1;

pub const GEO_SIZE: usize = 4 + 6; // 6 characters of resolution
pub const TWO_FACTOR_SIZE: usize = U8_SIZE * 32; // 256 bit
pub const REGION_SIZE: usize = 4 + 3; // 3 digit country code
