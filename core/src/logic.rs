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
}

/// A streak stays alive while yesterday has an entry, even if today is blank.
pub fn compute_streaks(keys: &[String], today: &str) -> Streaks {
    let days: BTreeSet<i64> = keys.iter().filter_map(|k| parse_key(k)).collect();
    let today_n = parse_key(today);

    let mut current = 0;
    if let Some(t) = today_n {
        let mut cursor = if days.contains(&t) { t } else { t - 1 };
        while days.contains(&cursor) {
            current += 1;
            cursor -= 1;
        }
    }

    let (mut longest, mut run, mut prev) = (0, 0, None);
    for &day in &days {
        run = if prev == Some(day - 1) { run + 1 } else { 1 };
        longest = longest.max(run);
        prev = Some(day);
    }

    Streaks {
        current,
        longest,
        total: days.len() as u32,
        missed_today: today_n.is_none_or(|t| !days.contains(&t)),
    }
}

// ── Spaced repetition ──────────────────────────────────────────────────────

const MIN_EASE: f64 = 1.3;
/// SM-2-ish ladder: a first review lands on the grade's own interval
/// (again 1d / hard 3d / good 7d / easy 14d); later reviews climb.
const INTERVALS: [i64; 8] = [1, 3, 7, 14, 30, 60, 120, 240];

#[derive(Debug, PartialEq)]
pub struct Schedule {
    pub repetitions: u32,
    pub ease_factor: f64,
    pub interval_days: i64,
    pub due_date: String,
}

/// Advance a schedule from a self-grade: 0 again, 1 hard, 2 good, 3 easy.
pub fn next_review(repetitions: u32, ease_factor: f64, grade: u8, today: &str) -> Schedule {
    let (reps, ef) = match grade {
        0 => (0, (ease_factor - 0.2).max(MIN_EASE)),
        1 => ((repetitions + 1).max(1), (ease_factor - 0.15).max(MIN_EASE)),
        2 => ((repetitions + 1).max(2), ease_factor),
        _ => ((repetitions + 1).max(3), ease_factor + 0.15),
    };
    let interval = INTERVALS[(reps as usize).min(INTERVALS.len() - 1)];
    Schedule {
        repetitions: reps,
        ease_factor: (ef * 100.0).round() / 100.0,
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
        let s = compute_streaks(&keys(&["2026-03-07", "2026-03-08", "2026-03-09"]), "2026-03-10");
        assert_eq!(s, Streaks { current: 3, longest: 3, total: 3, missed_today: true });
        let s = compute_streaks(&keys(&["2026-01-01", "2026-01-03"]), "2026-01-03");
        assert_eq!((s.current, s.longest), (1, 1));
    }

    #[test]
    fn review_ladder() {
        let s = next_review(0, 2.5, 2, "2026-10-19");
        assert_eq!((s.repetitions, s.interval_days, s.due_date.as_str()), (2, 7, "2026-10-26"));
        let s = next_review(5, 1.35, 0, "2026-10-19");
        assert_eq!((s.repetitions, s.ease_factor, s.interval_days), (0, 1.3, 1));
        assert_eq!(next_review(9, 2.5, 3, "2026-10-19").interval_days, 240);
    }

    #[test]
    fn queue_is_oldest_first_and_skips_today() {
        let q = due_queue(
            &keys(&["2026-10-19", "2026-10-10", "2026-10-01"]),
            &[("2026-10-01".into(), "2026-10-18".into()), ("2026-09-01".into(), "2026-11-01".into())],
            "2026-10-19",
        );
        assert_eq!(q, vec![("2026-10-01".into(), true), ("2026-10-10".into(), false)]);
    }

    #[test]
    fn routines() {
        let done = keys(&["2026-10-05"]);
        let r = Routine { start_date: "2026-10-01", gap_days: 2, adjust_from_last: true, completions: &done };
        assert!(routine_on(&r, "2026-10-05"));
        assert!(routine_on(&r, "2026-10-08"));
        assert!(!routine_on(&r, "2026-10-07"));
        assert!(!routine_on(&r, "2026-09-30"));
        assert_eq!(next_routine_date(&r, "2026-10-06").as_deref(), Some("2026-10-08"));
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
