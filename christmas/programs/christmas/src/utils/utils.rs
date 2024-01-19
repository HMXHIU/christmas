use crate::defs::{DATE_HASH_BITS, DATE_HASH_SIZE, DAYS_SINCE_1_JAN_2024, MS_PER_DAY};

pub fn pad_string(s: &str, length: usize) -> String {
    assert!(s.len() <= length);
    let zeros = vec![0u8; length - s.len()];

    return s.to_owned() + std::str::from_utf8(&zeros).unwrap();
}

pub fn epoch_days_from_date(date: u64) -> u64 {
    return date
        .div_euclid(MS_PER_DAY)
        .wrapping_sub(DAYS_SINCE_1_JAN_2024)
        % (DATE_HASH_BITS + 1);
}

pub fn u8_to_byte_mask(b: u8) -> u8 {
    let left_shift = 8 - b;

    match left_shift {
        0..=7 => 0xFF << left_shift,
        8 => 0x00, // to prevent 'attempt to shift left with overflow'
        _ => panic!("Input should be in the range 0 to 8"),
    }
}

pub fn days_to_byte_mask(days: u64) -> [u8; DATE_HASH_SIZE] {
    let mdays = days % (DATE_HASH_BITS + 1);
    let full_bytes = mdays / 8;
    let half_byte = mdays % 8;

    let mut byte_mask: [u8; DATE_HASH_SIZE] = [0; DATE_HASH_SIZE];
    // fill in full bytes
    for i in 0..full_bytes {
        byte_mask[i as usize] = 0xff;
    }
    // fill in half byte
    if full_bytes < DATE_HASH_SIZE as u64 {
        byte_mask[full_bytes as usize] = u8_to_byte_mask(half_byte as u8);
    }

    return byte_mask;
}

#[cfg(test)]
mod tests {
    use solana_program::log;

    use super::*;

    #[test]
    fn test_u8_to_byte_mask() {
        assert!(u8_to_byte_mask(0).eq(&0x00));
        assert!(u8_to_byte_mask(1).eq(&0b10000000));
        assert!(u8_to_byte_mask(2).eq(&0b11000000));
        assert!(u8_to_byte_mask(3).eq(&0b11100000));
        assert!(u8_to_byte_mask(4).eq(&0b11110000));
        assert!(u8_to_byte_mask(5).eq(&0b11111000));
        assert!(u8_to_byte_mask(6).eq(&0b11111100));
        assert!(u8_to_byte_mask(7).eq(&0b11111110));
        assert!(u8_to_byte_mask(8).eq(&0b11111111));
    }

    #[test]
    fn test_days_to_byte_mask() {
        let mut byte_mask: [u8; DATE_HASH_SIZE] = [0; DATE_HASH_SIZE];

        byte_mask[0] = 0xFF;
        assert!(days_to_byte_mask(8).eq(&byte_mask));

        byte_mask[1] = 0xFF;
        assert!(days_to_byte_mask(16).eq(&byte_mask));

        byte_mask = [0xFF; DATE_HASH_SIZE];
        assert!(days_to_byte_mask(256).eq(&byte_mask));

        byte_mask = [0x00; DATE_HASH_SIZE];
        assert!(days_to_byte_mask(257).eq(&byte_mask));
    }

    #[test]
    fn test_epoch_days_from_date() {
        let jan_1 = DAYS_SINCE_1_JAN_2024 * 24 * 60 * 60 * 1000;
        let jan_2 = (DAYS_SINCE_1_JAN_2024 + 1) * 24 * 60 * 60 * 1000;
        let last_epoch_day = (DAYS_SINCE_1_JAN_2024 + DATE_HASH_BITS) * 24 * 60 * 60 * 1000;
        let next_epoch_day_1 = (DAYS_SINCE_1_JAN_2024 + DATE_HASH_BITS + 1) * 24 * 60 * 60 * 1000;
        let next_epoch_day_2 = (DAYS_SINCE_1_JAN_2024 + DATE_HASH_BITS + 2) * 24 * 60 * 60 * 1000;

        assert!(epoch_days_from_date(jan_1).eq(&0));
        assert!(epoch_days_from_date(jan_2).eq(&1));
        assert!(epoch_days_from_date(last_epoch_day).eq(&DATE_HASH_BITS));
        assert!(epoch_days_from_date(next_epoch_day_1).eq(&0));

        let mut byte_mask: [u8; DATE_HASH_SIZE] = [0; DATE_HASH_SIZE];
        assert!(days_to_byte_mask(epoch_days_from_date(jan_1)).eq(&byte_mask));
        assert!(days_to_byte_mask(epoch_days_from_date(next_epoch_day_1)).eq(&byte_mask));

        byte_mask[0] = 0b10000000;
        assert!(days_to_byte_mask(epoch_days_from_date(next_epoch_day_2)).eq(&byte_mask));

        byte_mask = [0xFF; DATE_HASH_SIZE];
        assert!(days_to_byte_mask(epoch_days_from_date(last_epoch_day)).eq(&byte_mask));
    }
}
