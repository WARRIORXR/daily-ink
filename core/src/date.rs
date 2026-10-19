//! Calendar arithmetic on `yyyy-MM-dd` date keys.
//!
//! Keys are plain calendar days with no time zone, so this works in day
//! numbers (days since 1970-01-01) and never touches clocks or DST. The
//! caller supplies "today" as a key computed in the user's local time.

/// Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant's
/// days_from_civil).
pub fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let m = m as i64;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// Inverse of [`days_from_civil`].
pub fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Parse a `yyyy-MM-dd` key into a day number. Returns `None` for anything
/// that is not a real calendar date.
pub fn parse_key(key: &str) -> Option<i64> {
    let mut parts = key.trim().splitn(3, '-');
    let y: i64 = parts.next()?.parse().ok()?;
    let m: u32 = parts.next()?.parse().ok()?;
    let d: u32 = parts.next()?.parse().ok()?;
    if !(1..=12).contains(&m) || d == 0 || d > days_in_month(y, m) {
        return None;
    }
    Some(days_from_civil(y, m, d))
}

pub fn format_key(days: i64) -> String {
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02}")
}

pub fn add_days(key: &str, amount: i64) -> Option<String> {
    parse_key(key).map(|d| format_key(d + amount))
}

/// Same day `months` months earlier or later, clamped to the end of a shorter
/// month (31 March minus one month is 28 or 29 February).
pub fn add_months(key: &str, months: i64) -> Option<String> {
    let day = parse_key(key)?;
    let (y, m, d) = civil_from_days(day);
    let total = y * 12 + (m as i64 - 1) + months;
    let (ny, nm) = (total.div_euclid(12), (total.rem_euclid(12) + 1) as u32);
    let nd = d.min(days_in_month(ny, nm));
    Some(format_key(days_from_civil(ny, nm, nd)))
}

fn days_in_month(y: i64, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        _ if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 => 29,
        _ => 28,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_and_adds_across_boundaries() {
        assert_eq!(parse_key("1970-01-01"), Some(0));
        assert_eq!(add_days("2024-02-28", 1).as_deref(), Some("2024-02-29"));
        assert_eq!(add_days("2023-02-28", 1).as_deref(), Some("2023-03-01"));
        assert_eq!(add_days("2026-12-31", 1).as_deref(), Some("2027-01-01"));
        assert_eq!(add_days("2026-03-08", -1).as_deref(), Some("2026-03-07"));
        for day in -1000..30_000 {
            assert_eq!(parse_key(&format_key(day)), Some(day));
        }
    }

    #[test]
    fn adds_months_with_clamping() {
        assert_eq!(add_months("2026-10-19", -1).as_deref(), Some("2026-09-19"));
        assert_eq!(add_months("2026-03-31", -1).as_deref(), Some("2026-02-28"));
        assert_eq!(add_months("2024-03-31", -1).as_deref(), Some("2024-02-29"));
        assert_eq!(add_months("2026-01-15", -6).as_deref(), Some("2025-07-15"));
        assert_eq!(add_months("2026-10-19", -12).as_deref(), Some("2025-10-19"));
    }

    #[test]
    fn rejects_invalid_keys() {
        assert_eq!(parse_key("2023-02-29"), None);
        assert_eq!(parse_key("2026-13-01"), None);
        assert_eq!(parse_key("not-a-date"), None);
    }
}
