import { computeStreaks as computeStreaksCore } from '../core'
import { getEntryKey } from './formatDate'

/**
 * Streak statistics for a set of date keys ('yyyy-MM-dd'). Computed in Rust
 * (core/src/logic.rs). A streak is alive while yesterday has an entry even if
 * today is still blank.
 * @returns {{ current: number, longest: number, total: number, missedToday: boolean }}
 */
export function computeStreaks(dateKeys, todayKey = getEntryKey()) {
  return computeStreaksCore([...dateKeys], todayKey)
}
