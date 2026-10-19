//! Journal logic: streaks, spaced-repetition reviews, routines and the
//! "which day was this?" quiz. Pure functions over date keys; the wasm
//! bindings in `lib.rs` only convert to and from JavaScript values.

use crate::date::{add_days, format_key, parse_key};
use std::collections::BTreeSet;

// ── Streaks ────────────────────────────────────────────────────────────────

#[derive(Debug, PartialEq)]
pub struct Streaks {
    pub current: u32,
    pub longest: u32,
    pub total: u32,
    pub missed_today: bool,
    /// Missed days a freeze covered, oldest first.
    pub frozen: Vec<String>,
    /// Whether this week's freeze is still unused.
    pub freeze_ready: bool,
}

/// Monday-based week number (1970-01-01, day 0, was a Thursday).
fn week_of(day: i64) -> i64 {
    (day + 3).div_euclid(7)
}

/// Streaks over local-date keys. A blank today never breaks a streak, and one
/// "freeze" per calendar week (Monday to Sunday) covers a single missed day
/// that sits between two written days (or between a written day and today).
/// A frozen day keeps the streak alive but doesn't add to it.
pub fn compute_streaks(keys: &[String], today: &str) -> Streaks {
    let days: BTreeSet<i64> = keys.iter().filter_map(|k| parse_key(k)).collect();
    let Some(today_n) = parse_key(today) else {
        return Streaks {
            current: 0,
            longest: 0,
            total: days.len() as u32,
            missed_today: true,
            frozen: Vec::new(),
            freeze_ready: false,
        };
    };

    let mut used_weeks = BTreeSet::new();
    let mut frozen = Vec::new();
    let (mut run, mut longest) = (0u32, 0u32);
    if let Some(&first) = days.iter().next() {
        for day in first..=today_n {
            if days.contains(&day) {
                run += 1;
            } else if day == today_n {
                // Today isn't over yet.
            } else if !used_weeks.contains(&week_of(day))
                && days.contains(&(day - 1))
                && (days.contains(&(day + 1)) || day + 1 == today_n)
            {
                used_weeks.insert(week_of(day));
                frozen.push(day);
            } else {
                run = 0;
            }
            longest = longest.max(run);
        }
    }

    Streaks {
        current: run,
        longest,
        total: days.len() as u32,
        missed_today: !days.contains(&today_n),
        frozen: frozen.into_iter().map(format_key).collect(),
        freeze_ready: !used_weeks.contains(&week_of(today_n)),
    }
}

/// One cell per day of the heatmap, Monday-aligned columns of 7 days, ending
/// with the week that holds `today`. `levels` maps a date key to its 1–4
/// intensity; days after today come back as level -1 so they can be hidden.
pub fn heatmap(
    levels: &[(String, u8)],
    frozen: &[String],
    today: &str,
    weeks: u32,
) -> Vec<(String, i8)> {
    let Some(end) = parse_key(today) else {
        return Vec::new();
    };
    let by_day: std::collections::BTreeMap<i64, u8> = levels
        .iter()
        .filter_map(|(k, l)| parse_key(k).map(|d| (d, *l)))
        .collect();
    let frozen: BTreeSet<i64> = frozen.iter().filter_map(|k| parse_key(k)).collect();
    let last_monday = end - (end + 3).rem_euclid(7);
    let start = last_monday - 7 * (weeks as i64 - 1);
    (start..last_monday + 7)
        .map(|day| {
            let level = if day > end {
                -1
            } else if let Some(&l) = by_day.get(&day) {
                l.clamp(1, 4) as i8
            } else if frozen.contains(&day) {
                5 // frozen marker
            } else {
                0
            };
            (format_key(day), level)
        })
        .collect()
}

// ── Spaced repetition ──────────────────────────────────────────────────────

const MIN_EASE: f64 = 1.3;

#[derive(Debug, PartialEq)]
pub struct Schedule {
    pub repetitions: u32,
    pub ease_factor: f64,
    pub interval_days: i64,
    pub due_date: String,
}

/// SM-2 quality (0-5) for the four buttons: Again, Hard, Good, Easy.
pub fn quality_for(grade: u8) -> u8 {
    match grade {
        0 => 1,
        1 => 3,
        2 => 4,
        _ => 5,
    }
}

/// Standard SM-2 (Wozniak, 1990). `interval_days` is the previous interval.
/// - quality < 3 (Again): start over, see it again tomorrow.
/// - otherwise: 1 day, then 6 days, then previous interval × ease factor.
/// - the ease factor moves by 0.1 − (5 − q)(0.08 + (5 − q)·0.02), never below 1.3.
pub fn next_review(
    repetitions: u32,
    ease_factor: f64,
    interval_days: i64,
    grade: u8,
    today: &str,
) -> Schedule {
    let q = quality_for(grade) as f64;
    let ease = (ease_factor + 0.1 - (5.0 - q) * (0.08 + (5.0 - q) * 0.02)).max(MIN_EASE);
    let (reps, interval) = if q < 3.0 {
        (0, 1)
    } else {
        let interval = match repetitions {
            0 => 1,
            1 => 6,
            _ => ((interval_days.max(1) as f64) * ease_factor).round() as i64,
        };
        (repetitions + 1, interval)
    };
    Schedule {
        repetitions: reps,
        ease_factor: (ease * 100.0).round() / 100.0,
        interval_days: interval,
        due_date: add_days(today, interval).unwrap_or_else(|| today.to_string()),
    }
}

/// Review queue, oldest first: scheduled reviews that are due, plus entries
/// from before today that were never reviewed. Returns (date key, scheduled).
pub fn due_queue(
    entry_keys: &[String],
    reviews: &[(String, String)],
    today: &str,
) -> Vec<(String, bool)> {
    let reviewed: BTreeSet<&str> = reviews.iter().map(|(k, _)| k.as_str()).collect();
    let mut queue: Vec<(String, bool)> = reviews
        .iter()
        .filter(|(_, due)| due.as_str() <= today)
        .map(|(k, _)| (k.clone(), true))
        .collect();
    queue.extend(
        entry_keys
            .iter()
            .filter(|k| k.as_str() < today && !reviewed.contains(k.as_str()))
            .map(|k| (k.clone(), false)),
    );
    queue.sort_by_key(|(k, _)| parse_key(k).unwrap_or(i64::MAX));
    queue
}

// ── Routines ───────────────────────────────────────────────────────────────

pub struct Routine<'a> {
    pub start_date: &'a str,
    pub gap_days: i64,
    pub adjust_from_last: bool,
    pub completions: &'a [String],
}

/// Whether a routine falls on `date`. It repeats every `gap_days + 1` days
/// from the start date or, when adjusting, from the latest completion.
pub fn routine_on(r: &Routine, date: &str) -> bool {
    let interval = r.gap_days + 1;
    if r.start_date.is_empty() || interval <= 0 {
        return false;
    }
    if r.completions.iter().any(|c| c == date) {
        return true;
    }
    let (Some(day), Some(start)) = (parse_key(date), parse_key(r.start_date)) else {
        return false;
    };
    if day < start {
        return false;
    }
    if r.adjust_from_last {
        if let Some(last) = r.completions.iter().filter_map(|c| parse_key(c)).max() {
            if day > last {
                return (day - last) % interval == 0;
            }
        }
    }
    (day - start) % interval == 0
}

/// Next date on or after `from` the routine falls on, looking a year ahead.
pub fn next_routine_date(r: &Routine, from: &str) -> Option<String> {
    let start = parse_key(from)?;
    (0..=365)
        .map(|i| format_key(start + i))
        .find(|candidate| routine_on(r, candidate))
}

pub fn interval_summary(gap_days: i64) -> String {
    match gap_days {
        0 => "Every day".into(),
        1 => "Every other day (1 day gap)".into(),
        g => format!("Every {} days ({g} days gap)", g + 1),
    }
}

// ── Quiz ───────────────────────────────────────────────────────────────────

/// Small deterministic PRNG so the quiz can shuffle from a JS-provided seed.
struct XorShift(u32);

impl XorShift {
    fn next(&mut self, bound: usize) -> usize {
        let mut x = self.0.max(1);
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        (x as usize) % bound
    }

    fn shuffle<T>(&mut self, items: &mut [T]) {
        for i in (1..items.len()).rev() {
            items.swap(i, self.next(i + 1));
        }
    }
}

/// First `max_chars` characters of the text with whitespace collapsed.
pub fn snippet(text: &str, max_chars: usize) -> String {
    let clean = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if clean.chars().count() <= max_chars {
        return clean;
    }
    let cut: String = clean.chars().take(max_chars).collect();
    format!("{}…", cut.trim_end())
}

/// Three date options, one of them correct. Distractors come from the user's
/// other entries, padded with nearby earlier dates when there aren't enough.
pub fn quiz_options(date: &str, other_keys: &[String], seed: u32) -> Vec<String> {
    let mut rng = XorShift(seed);
    let mut others: Vec<String> = other_keys
        .iter()
        .filter(|k| k.as_str() != date)
        .cloned()
        .collect();
    rng.shuffle(&mut others);

    let mut options = vec![date.to_string()];
    let mut fallback = 1;
    while options.len() < 3 {
        match others.pop() {
            Some(k) if !options.contains(&k) => options.push(k),
            Some(_) => {}
            None => {
                if let Some(k) = add_days(date, -fallback) {
                    if !options.contains(&k) {
                        options.push(k);
                    }
                }
                fallback += 1;
            }
        }
    }
    rng.shuffle(&mut options);
    options
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keys(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn streaks_survive_dst_and_blank_today() {
        let s = compute_streaks(
            &keys(&["2026-03-07", "2026-03-08", "2026-03-09"]),
            "2026-03-10",
        );
        assert_eq!(
            (s.current, s.longest, s.total, s.missed_today),
            (3, 3, 3, true)
        );
        assert!(s.frozen.is_empty() && s.freeze_ready);
    }

    #[test]
    fn one_freeze_per_week_bridges_a_single_missed_day() {
        // Thu 1 Jan 2026 written, Fri 2 missed, Sat 3 written: frozen.
        let s = compute_streaks(&keys(&["2026-01-01", "2026-01-03"]), "2026-01-03");
        assert_eq!((s.current, s.longest), (2, 2));
        assert_eq!(s.frozen, vec!["2026-01-02".to_string()]);
        assert!(!s.freeze_ready);
        // A second miss in the same week (Mon 5 Jan is a new week, so use Tue/Thu).
        let s = compute_streaks(
            &keys(&["2026-01-05", "2026-01-07", "2026-01-09"]),
            "2026-01-09",
        );
        assert_eq!(s.frozen, vec!["2026-01-06".to_string()]);
        assert_eq!(s.current, 1); // Thu 8 Jan can't be frozen too
        assert_eq!(s.longest, 2);
        // Two missed days in a row break the streak.
        let s = compute_streaks(&keys(&["2026-01-05", "2026-01-08"]), "2026-01-08");
        assert_eq!((s.current, s.frozen.len()), (1, 0));
    }

    #[test]
    fn yesterday_missed_can_be_frozen_while_today_is_blank() {
        // Mon 12 Oct and Tue 13 written, Wed 14 missed, today Thu 15 blank.
        let s = compute_streaks(&keys(&["2026-10-12", "2026-10-13"]), "2026-10-15");
        assert_eq!((s.current, s.missed_today), (2, true));
        assert_eq!(s.frozen, vec!["2026-10-14".to_string()]);
        // Without a written day before the miss there's nothing to protect.
        assert_eq!(
            compute_streaks(&keys(&["2026-10-10"]), "2026-10-15").current,
            0
        );
    }

    #[test]
    fn heatmap_is_monday_aligned_and_ends_this_week() {
        let cells = heatmap(
            &[("2026-10-19".into(), 3)],
            &["2026-10-18".into()],
            "2026-10-21",
            2,
        );
        assert_eq!(cells.len(), 14);
        assert_eq!(cells[0].0, "2026-10-12"); // a Monday
        assert_eq!(cells[7], ("2026-10-19".to_string(), 3));
        assert_eq!(cells[6], ("2026-10-18".to_string(), 5));
        assert_eq!(cells[13], ("2026-10-25".to_string(), -1));
        assert_eq!(cells[8].1, 0);
    }

    #[test]
    fn sm2_first_reviews_are_1_then_6_days() {
        let s = next_review(0, 2.5, 0, 2, "2026-10-19"); // Good
        assert_eq!(
            (s.repetitions, s.interval_days, s.due_date.as_str()),
            (1, 1, "2026-10-20")
        );
        assert_eq!(s.ease_factor, 2.5); // q = 4 leaves the ease unchanged
        let s = next_review(1, 2.5, 1, 2, "2026-10-20");
        assert_eq!((s.repetitions, s.interval_days), (2, 6));
    }

    #[test]
    fn sm2_later_reviews_multiply_by_the_ease_factor() {
        let s = next_review(2, 2.5, 6, 2, "2026-10-19");
        assert_eq!((s.repetitions, s.interval_days), (3, 15)); // 6 × 2.5
        let s = next_review(3, 2.5, 15, 3, "2026-10-19"); // Easy
        assert_eq!((s.interval_days, s.ease_factor), (38, 2.6)); // round(15 × 2.5), ease + 0.1
    }

    #[test]
    fn sm2_hard_lowers_ease_and_again_resets() {
        let s = next_review(3, 2.5, 15, 1, "2026-10-19"); // Hard, q = 3
        assert_eq!((s.repetitions, s.ease_factor), (4, 2.36));
        let s = next_review(5, 2.5, 40, 0, "2026-10-19"); // Again, q = 1
        assert_eq!(
            (s.repetitions, s.interval_days, s.due_date.as_str()),
            (0, 1, "2026-10-20")
        );
        assert_eq!(s.ease_factor, 1.96); // 2.5 − 0.54
    }

    #[test]
    fn sm2_ease_never_drops_below_1_3() {
        let mut ease = 2.5;
        for _ in 0..20 {
            ease = next_review(0, ease, 1, 0, "2026-10-19").ease_factor;
        }
        assert_eq!(ease, 1.3);
    }

    #[test]
    fn queue_is_oldest_first_and_skips_today() {
        let q = due_queue(
            &keys(&["2026-10-19", "2026-10-10", "2026-10-01"]),
            &[
                ("2026-10-01".into(), "2026-10-18".into()),
                ("2026-09-01".into(), "2026-11-01".into()),
            ],
            "2026-10-19",
        );
        assert_eq!(
            q,
            vec![("2026-10-01".into(), true), ("2026-10-10".into(), false)]
        );
    }

    #[test]
    fn routines() {
        let done = keys(&["2026-10-05"]);
        let r = Routine {
            start_date: "2026-10-01",
            gap_days: 2,
            adjust_from_last: true,
            completions: &done,
        };
        assert!(routine_on(&r, "2026-10-05"));
        assert!(routine_on(&r, "2026-10-08"));
        assert!(!routine_on(&r, "2026-10-07"));
        assert!(!routine_on(&r, "2026-09-30"));
        assert_eq!(
            next_routine_date(&r, "2026-10-06").as_deref(),
            Some("2026-10-08")
        );
        assert_eq!(interval_summary(3), "Every 4 days (3 days gap)");
    }

    #[test]
    fn quiz_has_three_unique_options_including_answer() {
        for seed in 1..50 {
            let o = quiz_options("2026-10-19", &keys(&["2026-10-18"]), seed);
            assert_eq!(o.len(), 3);
            assert!(o.contains(&"2026-10-19".to_string()));
            assert_eq!(o.iter().collect::<BTreeSet<_>>().len(), 3);
        }
        assert_eq!(snippet("  a   b\nc ", 140), "a b c");
        assert_eq!(snippet("abcdef", 3), "abc…");
    }
}
