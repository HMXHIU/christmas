use geohash::{decode, encode, neighbor, Coordinate, Direction};
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
        Coordinate {
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

pub fn code_to_country(code: &str) -> Option<&str> {
    match code {
        "AFG" => Some("Afghanistan"),
        "ALB" => Some("Albania"),
        "DZA" => Some("Algeria"),
        "ASM" => Some("American Samoa"),
        "AND" => Some("Andorra"),
        "AGO" => Some("Angola"),
        "AIA" => Some("Anguilla"),
        "ATA" => Some("Antarctica"),
        "ATG" => Some("Antigua and Barbuda"),
        "ARG" => Some("Argentina"),
        "ARM" => Some("Armenia"),
        "ABW" => Some("Aruba"),
        "AUS" => Some("Australia"),
        "AUT" => Some("Austria"),
        "AZE" => Some("Azerbaijan"),
        "BHS" => Some("Bahamas (the)"),
        "BHR" => Some("Bahrain"),
        "BGD" => Some("Bangladesh"),
        "BRB" => Some("Barbados"),
        "BLR" => Some("Belarus"),
        "BEL" => Some("Belgium"),
        "BLZ" => Some("Belize"),
        "BEN" => Some("Benin"),
        "BMU" => Some("Bermuda"),
        "BTN" => Some("Bhutan"),
        "BOL" => Some("Bolivia (Plurinational State of)"),
        "BES" => Some("Bonaire, Sint Eustatius and Saba"),
        "BIH" => Some("Bosnia and Herzegovina"),
        "BWA" => Some("Botswana"),
        "BVT" => Some("Bouvet Island"),
        "BRA" => Some("Brazil"),
        "IOT" => Some("British Indian Ocean Territory (the)"),
        "BRN" => Some("Brunei Darussalam"),
        "BGR" => Some("Bulgaria"),
        "BFA" => Some("Burkina Faso"),
        "BDI" => Some("Burundi"),
        "CPV" => Some("Cabo Verde"),
        "KHM" => Some("Cambodia"),
        "CMR" => Some("Cameroon"),
        "CAN" => Some("Canada"),
        "CYM" => Some("Cayman Islands (the)"),
        "CAF" => Some("Central African Republic (the)"),
        "TCD" => Some("Chad"),
        "CHL" => Some("Chile"),
        "CHN" => Some("China"),
        "CXR" => Some("Christmas Island"),
        "CCK" => Some("Cocos (Keeling) Islands (the)"),
        "COL" => Some("Colombia"),
        "COM" => Some("Comoros (the)"),
        "COD" => Some("Congo (the Democratic Republic of the)"),
        "COG" => Some("Congo (the)"),
        "COK" => Some("Cook Islands (the)"),
        "CRI" => Some("Costa Rica"),
        "HRV" => Some("Croatia"),
        "CUB" => Some("Cuba"),
        "CUW" => Some("Curaçao"),
        "CYP" => Some("Cyprus"),
        "CZE" => Some("Czechia"),
        "CIV" => Some("Côte d'Ivoire"),
        "DNK" => Some("Denmark"),
        "DJI" => Some("Djibouti"),
        "DMA" => Some("Dominica"),
        "DOM" => Some("Dominican Republic (the)"),
        "ECU" => Some("Ecuador"),
        "EGY" => Some("Egypt"),
        "SLV" => Some("El Salvador"),
        "GNQ" => Some("Equatorial Guinea"),
        "ERI" => Some("Eritrea"),
        "EST" => Some("Estonia"),
        "SWZ" => Some("Eswatini"),
        "ETH" => Some("Ethiopia"),
        "FLK" => Some("Falkland Islands (the) [Malvinas]"),
        "FRO" => Some("Faroe Islands (the)"),
        "FJI" => Some("Fiji"),
        "FIN" => Some("Finland"),
        "FRA" => Some("France"),
        "GUF" => Some("French Guiana"),
        "PYF" => Some("French Polynesia"),
        "ATF" => Some("French Southern Territories (the)"),
        "GAB" => Some("Gabon"),
        "GMB" => Some("Gambia (the)"),
        "GEO" => Some("Georgia"),
        "DEU" => Some("Germany"),
        "GHA" => Some("Ghana"),
        "GIB" => Some("Gibraltar"),
        "GRC" => Some("Greece"),
        "GRL" => Some("Greenland"),
        "GRD" => Some("Grenada"),
        "GLP" => Some("Guadeloupe"),
        "GUM" => Some("Guam"),
        "GTM" => Some("Guatemala"),
        "GGY" => Some("Guernsey"),
        "GIN" => Some("Guinea"),
        "GNB" => Some("Guinea-Bissau"),
        "GUY" => Some("Guyana"),
        "HTI" => Some("Haiti"),
        "HMD" => Some("Heard Island and McDonald Islands"),
        "VAT" => Some("Holy See (the)"),
        "HND" => Some("Honduras"),
        "HKG" => Some("Hong Kong"),
        "HUN" => Some("Hungary"),
        "ISL" => Some("Iceland"),
        "IND" => Some("India"),
        "IDN" => Some("Indonesia"),
        "IRN" => Some("Iran (Islamic Republic of)"),
        "IRQ" => Some("Iraq"),
        "IRL" => Some("Ireland"),
        "IMN" => Some("Isle of Man"),
        "ISR" => Some("Israel"),
        "ITA" => Some("Italy"),
        "JAM" => Some("Jamaica"),
        "JPN" => Some("Japan"),
        "JEY" => Some("Jersey"),
        "JOR" => Some("Jordan"),
        "KAZ" => Some("Kazakhstan"),
        "KEN" => Some("Kenya"),
        "KIR" => Some("Kiribati"),
        "PRK" => Some("Korea (the Democratic People's Republic of)"),
        "KOR" => Some("Korea (the Republic of)"),
        "KWT" => Some("Kuwait"),
        "KGZ" => Some("Kyrgyzstan"),
        "LAO" => Some("Lao People's Democratic Republic (the)"),
        "LVA" => Some("Latvia"),
        "LBN" => Some("Lebanon"),
        "LSO" => Some("Lesotho"),
        "LBR" => Some("Liberia"),
        "LBY" => Some("Libya"),
        "LIE" => Some("Liechtenstein"),
        "LTU" => Some("Lithuania"),
        "LUX" => Some("Luxembourg"),
        "MAC" => Some("Macao"),
        "MDG" => Some("Madagascar"),
        "MWI" => Some("Malawi"),
        "MYS" => Some("Malaysia"),
        "MDV" => Some("Maldives"),
        "MLI" => Some("Mali"),
        "MLT" => Some("Malta"),
        "MHL" => Some("Marshall Islands (the)"),
        "MTQ" => Some("Martinique"),
        "MRT" => Some("Mauritania"),
        "MUS" => Some("Mauritius"),
        "MYT" => Some("Mayotte"),
        "MEX" => Some("Mexico"),
        "FSM" => Some("Micronesia (Federated States of)"),
        "MDA" => Some("Moldova (the Republic of)"),
        "MCO" => Some("Monaco"),
        "MNG" => Some("Mongolia"),
        "MNE" => Some("Montenegro"),
        "MSR" => Some("Montserrat"),
        "MAR" => Some("Morocco"),
        "MOZ" => Some("Mozambique"),
        "MMR" => Some("Myanmar"),
        "NAM" => Some("Namibia"),
        "NRU" => Some("Nauru"),
        "NPL" => Some("Nepal"),
        "NLD" => Some("Netherlands (the)"),
        "NCL" => Some("New Caledonia"),
        "NZL" => Some("New Zealand"),
        "NIC" => Some("Nicaragua"),
        "NER" => Some("Niger (the)"),
        "NGA" => Some("Nigeria"),
        "NIU" => Some("Niue"),
        "NFK" => Some("Norfolk Island"),
        "MNP" => Some("Northern Mariana Islands (the)"),
        "NOR" => Some("Norway"),
        "OMN" => Some("Oman"),
        "PAK" => Some("Pakistan"),
        "PLW" => Some("Palau"),
        "PSE" => Some("Palestine, State of"),
        "PAN" => Some("Panama"),
        "PNG" => Some("Papua New Guinea"),
        "PRY" => Some("Paraguay"),
        "PER" => Some("Peru"),
        "PHL" => Some("Philippines (the)"),
        "PCN" => Some("Pitcairn"),
        "POL" => Some("Poland"),
        "PRT" => Some("Portugal"),
        "PRI" => Some("Puerto Rico"),
        "QAT" => Some("Qatar"),
        "MKD" => Some("Republic of North Macedonia"),
        "ROU" => Some("Romania"),
        "RUS" => Some("Russian Federation (the)"),
        "RWA" => Some("Rwanda"),
        "REU" => Some("Réunion"),
        "BLM" => Some("Saint Barthélemy"),
        "SHN" => Some("Saint Helena, Ascension and Tristan da Cunha"),
        "KNA" => Some("Saint Kitts and Nevis"),
        "LCA" => Some("Saint Lucia"),
        "MAF" => Some("Saint Martin (French part)"),
        "SPM" => Some("Saint Pierre and Miquelon"),
        "VCT" => Some("Saint Vincent and the Grenadines"),
        "WSM" => Some("Samoa"),
        "SMR" => Some("San Marino"),
        "STP" => Some("Sao Tome and Principe"),
        "SAU" => Some("Saudi Arabia"),
        "SEN" => Some("Senegal"),
        "SRB" => Some("Serbia"),
        "SYC" => Some("Seychelles"),
        "SLE" => Some("Sierra Leone"),
        "SGP" => Some("Singapore"),
        "SXM" => Some("Sint Maarten (Dutch part)"),
        "SVK" => Some("Slovakia"),
        "SVN" => Some("Slovenia"),
        "SLB" => Some("Solomon Islands"),
        "SOM" => Some("Somalia"),
        "ZAF" => Some("South Africa"),
        "SGS" => Some("South Georgia and the South Sandwich Islands"),
        "SSD" => Some("South Sudan"),
        "ESP" => Some("Spain"),
        "LKA" => Some("Sri Lanka"),
        "SDN" => Some("Sudan (the)"),
        "SUR" => Some("Suriname"),
        "SJM" => Some("Svalbard and Jan Mayen"),
        "SWE" => Some("Sweden"),
        "CHE" => Some("Switzerland"),
        "SYR" => Some("Syrian Arab Republic"),
        "TWN" => Some("Taiwan (Province of China)"),
        "TJK" => Some("Tajikistan"),
        "TZA" => Some("Tanzania, United Republic of"),
        "THA" => Some("Thailand"),
        "TLS" => Some("Timor-Leste"),
        "TGO" => Some("Togo"),
        "TKL" => Some("Tokelau"),
        "TON" => Some("Tonga"),
        "TTO" => Some("Trinidad and Tobago"),
        "TUN" => Some("Tunisia"),
        "TUR" => Some("Turkey"),
        "TKM" => Some("Turkmenistan"),
        "TCA" => Some("Turks and Caicos Islands (the)"),
        "TUV" => Some("Tuvalu"),
        "UGA" => Some("Uganda"),
        "UKR" => Some("Ukraine"),
        "ARE" => Some("United Arab Emirates (the)"),
        "GBR" => Some("United Kingdom of Great Britain and Northern Ireland (the)"),
        "UMI" => Some("United States Minor Outlying Islands (the)"),
        "USA" => Some("United States of America (the)"),
        "URY" => Some("Uruguay"),
        "UZB" => Some("Uzbekistan"),
        "VUT" => Some("Vanuatu"),
        "VEN" => Some("Venezuela (Bolivarian Republic of)"),
        "VNM" => Some("Viet Nam"),
        "VGB" => Some("Virgin Islands (British)"),
        "VIR" => Some("Virgin Islands (U.S.)"),
        "WLF" => Some("Wallis and Futuna"),
        "ESH" => Some("Western Sahara"),
        "YEM" => Some("Yemen"),
        "ZMB" => Some("Zambia"),
        "ZWE" => Some("Zimbabwe"),
        "ALA" => Some("Åland Islands"),
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
