import { dailyPrompt, moodMap, wordStats } from '../core'

/** Writing prompt for a day; bump `offset` for another one. Picked in Rust. */
export function getPrompt(dateKey, offset = 0) {
  return dailyPrompt(dateKey, offset)
}

/** @returns {{ words: number, minutes: number }} */
export function getWordStats(text) {
  return wordStats(text ?? '')
}

/**
 * The last `days` days ending today, oldest first, with each day's mood, and
 * the most common mood among them.
 * @returns {{ days: { date: string, mood: string | null }[], top: string | null }}
 */
export function getMoodMap(entries, todayKey, days = 35) {
  const pairs = Object.entries(entries)
    .filter(([, entry]) => entry?.mood)
    .map(([key, entry]) => [key, entry.mood])
  return moodMap(pairs, todayKey, days)
}

const GOAL_KEY = 'dailyink:word-goal'
export const WORD_GOALS = [0, 100, 250, 500, 750]

export function loadWordGoal() {
  try {
    const value = Number(window.localStorage.getItem(GOAL_KEY))
    return WORD_GOALS.includes(value) ? value : 0
  } catch {
    return 0
  }
}

export function saveWordGoal(goal) {
  try {
    window.localStorage.setItem(GOAL_KEY, String(goal))
  } catch {
    // Private mode or blocked storage: the goal just won't be remembered.
  }
}
