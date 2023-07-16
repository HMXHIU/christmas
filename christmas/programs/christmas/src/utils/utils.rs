pub fn pad_string(s: &str, length: usize) -> String {
    assert!(s.len() <= length);
    let zeros = vec![0u8; length - s.len()];

    return s.to_owned() + std::str::from_utf8(&zeros).unwrap();
}
