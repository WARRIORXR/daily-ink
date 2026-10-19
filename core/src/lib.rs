//! WebAssembly bindings for Daily Ink's app logic. Each export converts
//! JavaScript values in and out and delegates to `logic`; the JS wrappers in
//! `src/utils/` keep the original function names for the React components.

mod date;
mod insights;
mod logic;

use logic::Routine;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

fn to_js<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(Into::into)
}

fn from_js<T: for<'de> Deserialize<'de>>(value: JsValue) -> Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value).map_err(Into::into)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StreaksOut {
    current: u32,
    longest: u32,
    total: u32,
    missed_today: bool,
}

#[wasm_bindgen(js_name = computeStreaks)]
pub fn compute_streaks(keys: JsValue, today: &str) -> Result<JsValue, JsValue> {
    let s = logic::compute_streaks(&from_js::<Vec<String>>(keys)?, today);
    to_js(&StreaksOut {
        current: s.current,
        longest: s.longest,
        total: s.total,
        missed_today: s.missed_today,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScheduleOut {
    repetitions: u32,
    ease_factor: f64,
    interval_days: i64,
    due_date: String,
}

#[wasm_bindgen(js_name = nextReview)]
pub fn next_review(repetitions: u32, ease_factor: f64, grade: u8, today: &str) -> Result<JsValue, JsValue> {
    let s = logic::next_review(repetitions, ease_factor, grade, today);
    to_js(&ScheduleOut {
        repetitions: s.repetitions,
        ease_factor: s.ease_factor,
        interval_days: s.interval_days,
        due_date: s.due_date,
    })
}

/// `reviews` is a list of `[dateKey, dueDate]` pairs. Returns
/// `[dateKey, scheduled]` pairs, oldest first.
#[wasm_bindgen(js_name = dueQueue)]
pub fn due_queue(entry_keys: JsValue, reviews: JsValue, today: &str) -> Result<JsValue, JsValue> {
    let reviews: Vec<(String, String)> = from_js(reviews)?;
    let queue = logic::due_queue(&from_js::<Vec<String>>(entry_keys)?, &reviews, today);
    to_js(&queue)
}

#[wasm_bindgen(js_name = routineOn)]
pub fn routine_on(
    start_date: &str,
    gap_days: i32,
    adjust_from_last: bool,
    completions: JsValue,
    date: &str,
) -> Result<bool, JsValue> {
    let completions: Vec<String> = from_js(completions)?;
    Ok(logic::routine_on(
        &Routine { start_date, gap_days: gap_days.into(), adjust_from_last, completions: &completions },
        date,
    ))
}

#[wasm_bindgen(js_name = nextRoutineDate)]
pub fn next_routine_date(
    start_date: &str,
    gap_days: i32,
    adjust_from_last: bool,
    completions: JsValue,
    from: &str,
) -> Result<Option<String>, JsValue> {
    let completions: Vec<String> = from_js(completions)?;
    Ok(logic::next_routine_date(
        &Routine { start_date, gap_days: gap_days.into(), adjust_from_last, completions: &completions },
        from,
    ))
}

#[wasm_bindgen(js_name = intervalSummary)]
pub fn interval_summary(gap_days: i32) -> String {
    logic::interval_summary(gap_days.into())
}

#[wasm_bindgen(js_name = addDays)]
pub fn add_days(key: &str, amount: i32) -> Option<String> {
    date::add_days(key, amount.into())
}

#[wasm_bindgen]
pub fn snippet(text: &str, max_chars: usize) -> String {
    logic::snippet(text, max_chars)
}

#[wasm_bindgen(js_name = quizOptions)]
pub fn quiz_options(date: &str, other_keys: JsValue, seed: u32) -> Result<JsValue, JsValue> {
    to_js(&logic::quiz_options(date, &from_js::<Vec<String>>(other_keys)?, seed))
}

#[wasm_bindgen(js_name = dailyPrompt)]
pub fn daily_prompt(date: &str, offset: i32) -> String {
    insights::daily_prompt(date, offset.into()).to_string()
}

#[derive(Serialize)]
struct WordStatsOut {
    words: u32,
    minutes: u32,
}

#[wasm_bindgen(js_name = wordStats)]
pub fn word_stats(text: &str) -> Result<JsValue, JsValue> {
    let (words, minutes) = insights::word_stats(text);
    to_js(&WordStatsOut { words, minutes })
}

#[derive(Serialize)]
struct MoodDay {
    date: String,
    mood: Option<String>,
}

#[derive(Serialize)]
struct MoodMapOut {
    days: Vec<MoodDay>,
    top: Option<String>,
}

/// `moods` is a list of `[dateKey, mood]` pairs.
#[wasm_bindgen(js_name = moodMap)]
pub fn mood_map(moods: JsValue, today: &str, days: u32) -> Result<JsValue, JsValue> {
    let moods: Vec<(String, String)> = from_js(moods)?;
    let (cells, top) = insights::mood_map(&moods, today, days);
    let days = cells.into_iter().map(|(date, mood)| MoodDay { date, mood }).collect();
    to_js(&MoodMapOut { days, top })
}
