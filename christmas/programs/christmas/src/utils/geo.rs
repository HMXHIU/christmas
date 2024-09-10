use geohash::{decode, encode, neighbor, Coord, Direction};
use std::collections::HashSet;

fn degrees_to_km(latitude: f64, longitude: f64) -> (f64, f64) {
    // Mean radius of the Earth in kilometers
    const EARTH_RADIUS_KM: f64 = 6371.0;

    // Convert latitude and longitude to radians
    let lat_rad = latitude.to_radians();
    let lon_rad = longitude.to_radians();

    // Calculate the distance in kilometers
    let lat_km = EARTH_RADIUS_KM * lat_rad.cos();
    let lon_km = EARTH_RADIUS_KM * lon_rad.cos();

    (lat_km, lon_km)
}

fn km_to_degrees(latitude_km: f64, longitude_km: f64) -> (f64, f64) {
    // Conversion factors for rough approximation
    const LAT_DEG_TO_KM: f64 = 110.574;
    const LON_DEG_TO_KM: f64 = 111.320;

    // Convert distances to degrees
    let lat_deg = latitude_km / LAT_DEG_TO_KM;
    let lon_deg = longitude_km / LON_DEG_TO_KM;

    (lat_deg, lon_deg)
}

pub fn get_geohashes_within_radius(geohash: &str, radius_km: u16) -> HashSet<String> {
    // get center lat lon
    let (center, _, _) = decode(geohash).unwrap();

    // get top left geohash
    let (delta_lat, delta_lon) = km_to_degrees(radius_km as f64, radius_km as f64);

    // get top left geohash
    let tl = encode(
        Coord {
            x: center.x - delta_lat,
            y: center.y + delta_lon,
        },
        6,
    )
    .unwrap();

    /*
        Calculate steps

        Step size for 6 digits
        x: 1.22 km
        y: 0.61 km
    */
    let steps_y: u16 = (radius_km as f64 * 2.0 / 0.61).ceil() as u16;
    let steps_x: u16 = (radius_km as f64 * 2.0 / 1.22).ceil() as u16;

    let mut geohashes = HashSet::new();
    geohashes.insert(tl.clone());

    let mut y_cur = tl.clone();
    let mut x_cur = tl.clone();

    for _ in 0..steps_y {
        x_cur = y_cur.clone();

        for _ in 0..steps_x {
            let next = neighbor(&x_cur, Direction::E).unwrap();
            x_cur = next.clone();
            geohashes.insert(next);
        }
        y_cur = neighbor(&y_cur, Direction::S).unwrap();
    }

    return geohashes;
}

pub fn code_bytes_to_country(code_bytes: &[u8; 3]) -> Option<String> {
    // ASCII conversion
    let code = String::from_utf8_lossy(code_bytes).to_string();
    return code_to_country(&code);
}

pub fn code_to_country(code: &str) -> Option<String> {
    match code {
        "@@@" => Some("@@@".to_string()),
        "AFG" => Some("Afghanistan".to_string()),
        "ALB" => Some("Albania".to_string()),
        "DZA" => Some("Algeria".to_string()),
        "ASM" => Some("American Samoa".to_string()),
        "AND" => Some("Andorra".to_string()),
        "AGO" => Some("Angola".to_string()),
        "AIA" => Some("Anguilla".to_string()),
        "ATA" => Some("Antarctica".to_string()),
        "ATG" => Some("Antigua and Barbuda".to_string()),
        "ARG" => Some("Argentina".to_string()),
        "ARM" => Some("Armenia".to_string()),
        "ABW" => Some("Aruba".to_string()),
        "AUS" => Some("Australia".to_string()),
        "AUT" => Some("Austria".to_string()),
        "AZE" => Some("Azerbaijan".to_string()),
        "BHS" => Some("Bahamas (the)".to_string()),
        "BHR" => Some("Bahrain".to_string()),
        "BGD" => Some("Bangladesh".to_string()),
        "BRB" => Some("Barbados".to_string()),
        "BLR" => Some("Belarus".to_string()),
        "BEL" => Some("Belgium".to_string()),
        "BLZ" => Some("Belize".to_string()),
        "BEN" => Some("Benin".to_string()),
        "BMU" => Some("Bermuda".to_string()),
        "BTN" => Some("Bhutan".to_string()),
        "BOL" => Some("Bolivia (Plurinational State of)".to_string()),
        "BES" => Some("Bonaire, Sint Eustatius and Saba".to_string()),
        "BIH" => Some("Bosnia and Herzegovina".to_string()),
        "BWA" => Some("Botswana".to_string()),
        "BVT" => Some("Bouvet Island".to_string()),
        "BRA" => Some("Brazil".to_string()),
        "IOT" => Some("British Indian Ocean Territory (the)".to_string()),
        "BRN" => Some("Brunei Darussalam".to_string()),
        "BGR" => Some("Bulgaria".to_string()),
        "BFA" => Some("Burkina Faso".to_string()),
        "BDI" => Some("Burundi".to_string()),
        "CPV" => Some("Cabo Verde".to_string()),
        "KHM" => Some("Cambodia".to_string()),
        "CMR" => Some("Cameroon".to_string()),
        "CAN" => Some("Canada".to_string()),
        "CYM" => Some("Cayman Islands (the)".to_string()),
        "CAF" => Some("Central African Republic (the)".to_string()),
        "TCD" => Some("Chad".to_string()),
        "CHL" => Some("Chile".to_string()),
        "CHN" => Some("China".to_string()),
        "CXR" => Some("Christmas Island".to_string()),
        "CCK" => Some("Cocos (Keeling) Islands (the)".to_string()),
        "COL" => Some("Colombia".to_string()),
        "COM" => Some("Comoros (the)".to_string()),
        "COD" => Some("Congo (the Democratic Republic of the)".to_string()),
        "COG" => Some("Congo (the)".to_string()),
        "COK" => Some("Cook Islands (the)".to_string()),
        "CRI" => Some("Costa Rica".to_string()),
        "HRV" => Some("Croatia".to_string()),
        "CUB" => Some("Cuba".to_string()),
        "CUW" => Some("Curaçao".to_string()),
        "CYP" => Some("Cyprus".to_string()),
        "CZE" => Some("Czechia".to_string()),
        "CIV" => Some("Côte d'Ivoire".to_string()),
        "DNK" => Some("Denmark".to_string()),
        "DJI" => Some("Djibouti".to_string()),
        "DMA" => Some("Dominica".to_string()),
        "DOM" => Some("Dominican Republic (the)".to_string()),
        "ECU" => Some("Ecuador".to_string()),
        "EGY" => Some("Egypt".to_string()),
        "SLV" => Some("El Salvador".to_string()),
        "GNQ" => Some("Equatorial Guinea".to_string()),
        "ERI" => Some("Eritrea".to_string()),
        "EST" => Some("Estonia".to_string()),
        "SWZ" => Some("Eswatini".to_string()),
        "ETH" => Some("Ethiopia".to_string()),
        "FLK" => Some("Falkland Islands (the) [Malvinas]".to_string()),
        "FRO" => Some("Faroe Islands (the)".to_string()),
        "FJI" => Some("Fiji".to_string()),
        "FIN" => Some("Finland".to_string()),
        "FRA" => Some("France".to_string()),
        "GUF" => Some("French Guiana".to_string()),
        "PYF" => Some("French Polynesia".to_string()),
        "ATF" => Some("French Southern Territories (the)".to_string()),
        "GAB" => Some("Gabon".to_string()),
        "GMB" => Some("Gambia (the)".to_string()),
        "GEO" => Some("Georgia".to_string()),
        "DEU" => Some("Germany".to_string()),
        "GHA" => Some("Ghana".to_string()),
        "GIB" => Some("Gibraltar".to_string()),
        "GRC" => Some("Greece".to_string()),
        "GRL" => Some("Greenland".to_string()),
        "GRD" => Some("Grenada".to_string()),
        "GLP" => Some("Guadeloupe".to_string()),
        "GUM" => Some("Guam".to_string()),
        "GTM" => Some("Guatemala".to_string()),
        "GGY" => Some("Guernsey".to_string()),
        "GIN" => Some("Guinea".to_string()),
        "GNB" => Some("Guinea-Bissau".to_string()),
        "GUY" => Some("Guyana".to_string()),
        "HTI" => Some("Haiti".to_string()),
        "HMD" => Some("Heard Island and McDonald Islands".to_string()),
        "VAT" => Some("Holy See (the)".to_string()),
        "HND" => Some("Honduras".to_string()),
        "HKG" => Some("Hong Kong".to_string()),
        "HUN" => Some("Hungary".to_string()),
        "ISL" => Some("Iceland".to_string()),
        "IND" => Some("India".to_string()),
        "IDN" => Some("Indonesia".to_string()),
        "IRN" => Some("Iran (Islamic Republic of)".to_string()),
        "IRQ" => Some("Iraq".to_string()),
        "IRL" => Some("Ireland".to_string()),
        "IMN" => Some("Isle of Man".to_string()),
        "ISR" => Some("Israel".to_string()),
        "ITA" => Some("Italy".to_string()),
        "JAM" => Some("Jamaica".to_string()),
        "JPN" => Some("Japan".to_string()),
        "JEY" => Some("Jersey".to_string()),
        "JOR" => Some("Jordan".to_string()),
        "KAZ" => Some("Kazakhstan".to_string()),
        "KEN" => Some("Kenya".to_string()),
        "KIR" => Some("Kiribati".to_string()),
        "PRK" => Some("Korea (the Democratic People's Republic of)".to_string()),
        "KOR" => Some("Korea (the Republic of)".to_string()),
        "KWT" => Some("Kuwait".to_string()),
        "KGZ" => Some("Kyrgyzstan".to_string()),
        "LAO" => Some("Lao People's Democratic Republic (the)".to_string()),
        "LVA" => Some("Latvia".to_string()),
        "LBN" => Some("Lebanon".to_string()),
        "LSO" => Some("Lesotho".to_string()),
        "LBR" => Some("Liberia".to_string()),
        "LBY" => Some("Libya".to_string()),
        "LIE" => Some("Liechtenstein".to_string()),
        "LTU" => Some("Lithuania".to_string()),
        "LUX" => Some("Luxembourg".to_string()),
        "MAC" => Some("Macao".to_string()),
        "MDG" => Some("Madagascar".to_string()),
        "MWI" => Some("Malawi".to_string()),
        "MYS" => Some("Malaysia".to_string()),
        "MDV" => Some("Maldives".to_string()),
        "MLI" => Some("Mali".to_string()),
        "MLT" => Some("Malta".to_string()),
        "MHL" => Some("Marshall Islands (the)".to_string()),
        "MTQ" => Some("Martinique".to_string()),
        "MRT" => Some("Mauritania".to_string()),
        "MUS" => Some("Mauritius".to_string()),
        "MYT" => Some("Mayotte".to_string()),
        "MEX" => Some("Mexico".to_string()),
        "FSM" => Some("Micronesia (Federated States of)".to_string()),
        "MDA" => Some("Moldova (the Republic of)".to_string()),
        "MCO" => Some("Monaco".to_string()),
        "MNG" => Some("Mongolia".to_string()),
        "MNE" => Some("Montenegro".to_string()),
        "MSR" => Some("Montserrat".to_string()),
        "MAR" => Some("Morocco".to_string()),
        "MOZ" => Some("Mozambique".to_string()),
        "MMR" => Some("Myanmar".to_string()),
        "NAM" => Some("Namibia".to_string()),
        "NRU" => Some("Nauru".to_string()),
        "NPL" => Some("Nepal".to_string()),
        "NLD" => Some("Netherlands (the)".to_string()),
        "NCL" => Some("New Caledonia".to_string()),
        "NZL" => Some("New Zealand".to_string()),
        "NIC" => Some("Nicaragua".to_string()),
        "NER" => Some("Niger (the)".to_string()),
        "NGA" => Some("Nigeria".to_string()),
        "NIU" => Some("Niue".to_string()),
        "NFK" => Some("Norfolk Island".to_string()),
        "MNP" => Some("Northern Mariana Islands (the)".to_string()),
        "NOR" => Some("Norway".to_string()),
        "OMN" => Some("Oman".to_string()),
        "PAK" => Some("Pakistan".to_string()),
        "PLW" => Some("Palau".to_string()),
        "PSE" => Some("Palestine, State of".to_string()),
        "PAN" => Some("Panama".to_string()),
        "PNG" => Some("Papua New Guinea".to_string()),
        "PRY" => Some("Paraguay".to_string()),
        "PER" => Some("Peru".to_string()),
        "PHL" => Some("Philippines (the)".to_string()),
        "PCN" => Some("Pitcairn".to_string()),
        "POL" => Some("Poland".to_string()),
        "PRT" => Some("Portugal".to_string()),
        "PRI" => Some("Puerto Rico".to_string()),
        "QAT" => Some("Qatar".to_string()),
        "MKD" => Some("Republic of North Macedonia".to_string()),
        "ROU" => Some("Romania".to_string()),
        "RUS" => Some("Russian Federation (the)".to_string()),
        "RWA" => Some("Rwanda".to_string()),
        "REU" => Some("Réunion".to_string()),
        "BLM" => Some("Saint Barthélemy".to_string()),
        "SHN" => Some("Saint Helena, Ascension and Tristan da Cunha".to_string()),
        "KNA" => Some("Saint Kitts and Nevis".to_string()),
        "LCA" => Some("Saint Lucia".to_string()),
        "MAF" => Some("Saint Martin (French part)".to_string()),
        "SPM" => Some("Saint Pierre and Miquelon".to_string()),
        "VCT" => Some("Saint Vincent and the Grenadines".to_string()),
        "WSM" => Some("Samoa".to_string()),
        "SMR" => Some("San Marino".to_string()),
        "STP" => Some("Sao Tome and Principe".to_string()),
        "SAU" => Some("Saudi Arabia".to_string()),
        "SEN" => Some("Senegal".to_string()),
        "SRB" => Some("Serbia".to_string()),
        "SYC" => Some("Seychelles".to_string()),
        "SLE" => Some("Sierra Leone".to_string()),
        "SGP" => Some("Singapore".to_string()),
        "SXM" => Some("Sint Maarten (Dutch part)".to_string()),
        "SVK" => Some("Slovakia".to_string()),
        "SVN" => Some("Slovenia".to_string()),
        "SLB" => Some("Solomon Islands".to_string()),
        "SOM" => Some("Somalia".to_string()),
        "ZAF" => Some("South Africa".to_string()),
        "SGS" => Some("South Georgia and the South Sandwich Islands".to_string()),
        "SSD" => Some("South Sudan".to_string()),
        "ESP" => Some("Spain".to_string()),
        "LKA" => Some("Sri Lanka".to_string()),
        "SDN" => Some("Sudan (the)".to_string()),
        "SUR" => Some("Suriname".to_string()),
        "SJM" => Some("Svalbard and Jan Mayen".to_string()),
        "SWE" => Some("Sweden".to_string()),
        "CHE" => Some("Switzerland".to_string()),
        "SYR" => Some("Syrian Arab Republic".to_string()),
        "TWN" => Some("Taiwan (Province of China)".to_string()),
        "TJK" => Some("Tajikistan".to_string()),
        "TZA" => Some("Tanzania, United Republic of".to_string()),
        "THA" => Some("Thailand".to_string()),
        "TLS" => Some("Timor-Leste".to_string()),
        "TGO" => Some("Togo".to_string()),
        "TKL" => Some("Tokelau".to_string()),
        "TON" => Some("Tonga".to_string()),
        "TTO" => Some("Trinidad and Tobago".to_string()),
        "TUN" => Some("Tunisia".to_string()),
        "TUR" => Some("Turkey".to_string()),
        "TKM" => Some("Turkmenistan".to_string()),
        "TCA" => Some("Turks and Caicos Islands (the)".to_string()),
        "TUV" => Some("Tuvalu".to_string()),
        "UGA" => Some("Uganda".to_string()),
        "UKR" => Some("Ukraine".to_string()),
        "ARE" => Some("United Arab Emirates (the)".to_string()),
        "GBR" => Some("United Kingdom of Great Britain and Northern Ireland (the)".to_string()),
        "UMI" => Some("United States Minor Outlying Islands (the)".to_string()),
        "USA" => Some("United States of America (the)".to_string()),
        "URY" => Some("Uruguay".to_string()),
        "UZB" => Some("Uzbekistan".to_string()),
        "VUT" => Some("Vanuatu".to_string()),
        "VEN" => Some("Venezuela (Bolivarian Republic of)".to_string()),
        "VNM" => Some("Viet Nam".to_string()),
        "VGB" => Some("Virgin Islands (British)".to_string()),
        "VIR" => Some("Virgin Islands (U.S.)".to_string()),
        "WLF" => Some("Wallis and Futuna".to_string()),
        "ESH" => Some("Western Sahara".to_string()),
        "YEM" => Some("Yemen".to_string()),
        "ZMB" => Some("Zambia".to_string()),
        "ZWE" => Some("Zimbabwe".to_string()),
        "ALA" => Some("Åland Islands".to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_geohashes_within_radius() {
        let center = "w21zdq";
        let radius = 5;
        let geohashes = get_geohashes_within_radius(&center, radius);

        println!(
            "geohashes {}km around {}): {:?}",
            radius, &center, geohashes
        );

        let around_singapore: HashSet<String> = vec![
            "w21z3w", "w21ze8", "w21zgh", "w21zem", "w21zd5", "w21z9c", "w21zg8", "w21ze0",
            "w21zcs", "w21zew", "w21zct", "w21zd4", "w21zek", "w21zcw", "w21zds", "w21zfs",
            "w21z7r", "w21z9f", "w21zf4", "w21z9b", "w21z6x", "w21zdt", "w21ze7", "w21zgs",
            "w21z6w", "w21z6z", "w21zd9", "w21z7q", "w21zdn", "w21zdy", "w21zcd", "w21z9s",
            "w21zd0", "w21ze2", "w21zcc", "w21zcg", "w21zg1", "w21zfd", "w21zg4", "w21zex",
            "w21zej", "w21zes", "w21zfm", "w21z3z", "w21z6y", "w21z9e", "w21zfj", "w21zf5",
            "w21zf7", "w21zen", "w21zd6", "w21zfn", "w21zfk", "w21zc8", "w21zgn", "w21zd2",
            "w21zet", "w21zfq", "w21z9z", "w21ze4", "w21zgw", "w21zed", "w21z98", "w21zfg",
            "w21zee", "w21zde", "w21z6n", "w21zd8", "w21zf0", "w21zfh", "w21zge", "w21zft",
            "w21zfw", "w21zg2", "w21zdh", "w21zcb", "w21ze9", "w21zf6", "w21z7n", "w21zeh",
            "w21ze3", "w21zgj", "w21zeq", "w21zdv", "w21z6q", "w21z99", "w21z9u", "w21z7x",
            "w21zdw", "w21zcy", "w21z9d", "w21zdc", "w21zf2", "w21zdu", "w21zdz", "w21zf9",
            "w21zer", "w21zff", "w21zdr", "w21zcf", "w21z3x", "w21zd7", "w21zd1", "w21zdd",
            "w21z3y", "w21zfb", "w21zep", "w21zd3", "w21z6p", "w21zg3", "w21zgd", "w21zfe",
            "w21z9y", "w21zdk", "w21zdq", "w21zgk", "w21zg5", "w21zgq", "w21z9w", "w21ze6",
            "w21zg7", "w21zcu", "w21z6r", "w21zce", "w21zdp", "w21ze5", "w21ze1", "w21zdb",
            "w21zcq", "w21zfv", "w21zf8", "w21z9g", "w21z9t", "w21zfu", "w21z7p", "w21z7w",
            "w21zf1", "w21zf3", "w21zg6", "w21zdf", "w21zcv", "w21zfc", "w21zg0", "w21zdx",
            "w21zgm", "w21zc9", "w21zdj", "w21zdg", "w21zfy", "w21zdm", "w21zgt", "w21z9v",
            "w21z9x", "w21zg9",
        ]
        .into_iter()
        .map(|x| x.to_owned())
        .collect();

        assert!(around_singapore.eq(&geohashes));
    }
}
