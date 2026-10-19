//! Writing helpers: daily prompts, word counts and the mood map.

use crate::date::{format_key, parse_key};
use std::collections::BTreeMap;

const PROMPTS: [&str; 30] = [
    "What made you smile today, even for a second?",
    "Describe one small thing you noticed that others might have missed.",
    "What is something you're looking forward to this week?",
    "Who did you talk to today, and what stayed with you from it?",
    "What drained your energy today, and what gave some back?",
    "Write about a place you went today as if seeing it for the first time.",
    "What's one thing you learned today?",
    "If today had a title, what would it be?",
    "What would you tell yourself from this morning?",
    "What are three things you're grateful for right now?",
    "What did you avoid today, and why?",
    "Describe the best thing you ate or drank today.",
    "What's on your mind that you haven't said out loud?",
    "What did you do today that future you will thank you for?",
    "Which moment today would you replay if you could?",
    "What song, sound or smell fits today?",
    "What's a worry you can let go of tonight?",
    "Write about someone you miss.",
    "What made you feel proud today?",
    "What's one thing you'd do differently if you lived today again?",
    "What surprised you today?",
    "How did your body feel today?",
    "What are you curious about lately?",
    "Write a short letter to someone you met today.",
    "What's a habit you're building, and how is it going?",
    "Describe your mood using the weather.",
    "What did you read, watch or listen to today?",
    "What's something kind someone did for you recently?",
    "Where do you want to be one year from today?",
    "Finish this sentence: today I realised…",
];

/// A writing prompt for the day. `offset` steps to the next prompt when the
/// user asks for another one; the same day and offset always give the same text.
pub fn daily_prompt(date: &str, offset: i64) -> &'static str {
    let day = parse_key(date).unwrap_or(0);
    let len = PROMPTS.len() as i64;
    // Multiply by a step coprime with 30 so consecutive days don't walk the list in order.
    PROMPTS[((day * 7 + offset) % len + len) as usize % PROMPTS.len()]
}

/// Words in the text and minutes to read it at about 200 words a minute.
pub fn word_stats(text: &str) -> (u32, u32) {
    let words = text.split_whitespace().filter(|w| w.chars().any(char::is_alphanumeric)).count() as u32;
    (words, words.div_ceil(200))
}

/// The last `days` days ending on `today`, oldest first, each with its mood
/// (if any), plus the most common mood among them (ties go to the most recent).
pub fn mood_map(moods: &[(String, String)], today: &str, days: u32) -> (Vec<(String, Option<String>)>, Option<String>) {
    let Some(end) = parse_key(today) else {
        return (Vec::new(), None);
    };
    let by_day: BTreeMap<i64, &str> = moods
        .iter()
        .filter(|(_, mood)| !mood.is_empty())
        .filter_map(|(k, mood)| parse_key(k).map(|d| (d, mood.as_str())))
        .collect();

    let mut counts: BTreeMap<&str, (u32, i64)> = BTreeMap::new();
    let cells = (end - days as i64 + 1..=end)
        .map(|day| {
            let mood = by_day.get(&day).copied();
            if let Some(m) = mood {
                let entry = counts.entry(m).or_insert((0, day));
                *entry = (entry.0 + 1, day);
            }
            (format_key(day), mood.map(str::to_string))
        })
        .collect();
    let top = counts
        .into_iter()
        .max_by_key(|&(_, (count, last))| (count, last))
        .map(|(m, _)| m.to_string());
    (cells, top)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompts_are_stable_and_offset_changes_them() {
        assert_eq!(daily_prompt("2026-10-19", 0), daily_prompt("2026-10-19", 0));
        assert_ne!(daily_prompt("2026-10-19", 0), daily_prompt("2026-10-19", 1));
        assert_ne!(daily_prompt("2026-10-19", 0), daily_prompt("2026-10-20", 0));
        assert_eq!(daily_prompt("2026-10-19", 30), daily_prompt("2026-10-19", 0));
        assert!(!daily_prompt("bad", -5).is_empty());
    }

    #[test]
    fn counts_words_not_punctuation() {
        assert_eq!(word_stats(""), (0, 0));
        assert_eq!(word_stats("  Hello,  world — again!\n"), (3, 1));
        assert_eq!(word_stats(&"word ".repeat(401)), (401, 3));
    }

    #[test]
    fn mood_map_covers_the_window_and_finds_the_top_mood() {
        let moods = vec![
            ("2026-10-17".to_string(), "good".to_string()),
            ("2026-10-18".to_string(), "low".to_string()),
            ("2026-10-19".to_string(), "low".to_string()),
            ("2026-09-01".to_string(), "great".to_string()),
            ("2026-10-16".to_string(), String::new()),
        ];
        let (cells, top) = mood_map(&moods, "2026-10-19", 4);
        assert_eq!(cells.first().unwrap(), &("2026-10-16".to_string(), None));
        assert_eq!(cells.last().unwrap(), &("2026-10-19".to_string(), Some("low".to_string())));
        assert_eq!(cells.len(), 4);
        assert_eq!(top.as_deref(), Some("low"));
        assert_eq!(mood_map(&[], "2026-10-19", 3).1, None);
    }
}
