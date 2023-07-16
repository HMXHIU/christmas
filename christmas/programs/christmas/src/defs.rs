pub const DISCRIMINATOR_SIZE: usize = 8;
pub const PUBKEY_SIZE: usize = 32;
pub const U8_SIZE: usize = 1;
pub const U64_SIZE: usize = 8;
pub const BOOL_SIZE: usize = 1;
pub const STRING_PREFIX_SIZE: usize = 4;

pub const BUMP_SIZE: usize = 1;

pub const GEO_SIZE: usize = STRING_PREFIX_SIZE + 6; // 6 characters of resolution
pub const TWO_FACTOR_SIZE: usize = U8_SIZE * 32; // 256 bit
pub const REGION_SIZE: usize = STRING_PREFIX_SIZE + 3; // 3 digit country code

pub const COUPON_NAME_SIZE: usize = STRING_PREFIX_SIZE + 36;
pub const COUPON_SYMBOL_SIZE: usize = STRING_PREFIX_SIZE + 14;
pub const COUPON_URI_SIZE: usize = STRING_PREFIX_SIZE + 204;

pub const REGION_CODES: &'static [&'static str] = &[
    "AFG", "ALB", "DZA", "ASM", "AND", "AGO", "AIA", "ATA", "ATG", "ARG", "ARM", "ABW", "AUS",
    "AUT", "AZE", "BHS", "BHR", "BGD", "BRB", "BLR", "BEL", "BLZ", "BEN", "BMU", "BTN", "BOL",
    "BES", "BIH", "BWA", "BVT", "BRA", "IOT", "BRN", "BGR", "BFA", "BDI", "CPV", "KHM", "CMR",
    "CAN", "CYM", "CAF", "TCD", "CHL", "CHN", "CXR", "CCK", "COL", "COM", "COD", "COG", "COK",
    "CRI", "HRV", "CUB", "CUW", "CYP", "CZE", "CIV", "DNK", "DJI", "DMA", "DOM", "ECU", "EGY",
    "SLV", "GNQ", "ERI", "EST", "SWZ", "ETH", "FLK", "FRO", "FJI", "FIN", "FRA", "GUF", "PYF",
    "ATF", "GAB", "GMB", "GEO", "DEU", "GHA", "GIB", "GRC", "GRL", "GRD", "GLP", "GUM", "GTM",
    "GGY", "GIN", "GNB", "GUY", "HTI", "HMD", "VAT", "HND", "HKG", "HUN", "ISL", "IND", "IDN",
    "IRN", "IRQ", "IRL", "IMN", "ISR", "ITA", "JAM", "JPN", "JEY", "JOR", "KAZ", "KEN", "KIR",
    "PRK", "KOR", "KWT", "KGZ", "LAO", "LVA", "LBN", "LSO", "LBR", "LBY", "LIE", "LTU", "LUX",
    "MAC", "MDG", "MWI", "MYS", "MDV", "MLI", "MLT", "MHL", "MTQ", "MRT", "MUS", "MYT", "MEX",
    "FSM", "MDA", "MCO", "MNG", "MNE", "MSR", "MAR", "MOZ", "MMR", "NAM", "NRU", "NPL", "NLD",
    "NCL", "NZL", "NIC", "NER", "NGA", "NIU", "NFK", "MNP", "NOR", "OMN", "PAK", "PLW", "PSE",
    "PAN", "PNG", "PRY", "PER", "PHL", "PCN", "POL", "PRT", "PRI", "QAT", "MKD", "ROU", "RUS",
    "RWA", "REU", "BLM", "SHN", "KNA", "LCA", "MAF", "SPM", "VCT", "WSM", "SMR", "STP", "SAU",
    "SEN", "SRB", "SYC", "SLE", "SGP", "SXM", "SVK", "SVN", "SLB", "SOM", "ZAF", "SGS", "SSD",
    "ESP", "LKA", "SDN", "SUR", "SJM", "SWE", "CHE", "SYR", "TWN", "TJK", "TZA", "THA", "TLS",
    "TGO", "TKL", "TON", "TTO", "TUN", "TUR", "TKM", "TCA", "TUV", "UGA", "UKR", "ARE", "GBR",
    "UMI", "USA", "URY", "UZB", "VUT", "VEN", "VNM", "VGB", "VIR", "WLF", "ESH", "YEM", "ZMB",
    "ZWE", "ALA",
];
