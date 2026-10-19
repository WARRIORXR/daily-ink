import { computeStreaks as computeStreaksCore, heatmap } from '../core'
import { getEntryKey } from './formatDate'
import { isEncrypted } from './crypto'

/**
 * Streak statistics for a set of local date keys ('yyyy-MM-dd'). Computed in
 * Rust (core/src/logic.rs). A blank today never breaks a streak, and one
 * freeze per Monday-to-Sunday week covers a single missed day.
 * @returns {{ current: number, longest: number, total: number, missedToday: boolean,
 *   frozen: string[], freezeReady: boolean }}
 */
export function computeStreaks(dateKeys, todayKey = getEntryKey()) {
  return computeStreaksCore([...dateKeys], todayKey)
}

// Heatmap shade from how much was written (encrypted text is ~4/3 longer).
function levelFor(entry) {
  const raw = entry?.content?.length ?? 0
  const length = isEncrypted(entry?.content) ? raw * 0.75 : raw
  if (length < 280) return 1
  if (length < 900) return 2
  if (length < 2000) return 3
  return 4
}

/**
 * Last `weeks` weeks as Monday-first columns of 7 days.
 * @returns {{ date: string, level: number }[]} level 0 blank, 1-4 written, 5 frozen, -1 future
 */
export function buildHeatmap(entries, frozen, todayKey, weeks = 53) {
  const levels = Object.entries(entries).map(([date, entry]) => [date, levelFor(entry)])
  return heatmap(levels, frozen, todayKey, weeks).map(([date, level]) => ({ date, level }))
}
