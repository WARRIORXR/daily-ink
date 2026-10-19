import { dueQueue, nextReview } from '../core'
import { getEntryKey } from './formatDate'

/**
 * Advance a review schedule with standard SM-2 (computed in Rust,
 * core/src/logic.rs). grade: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy.
 * @returns {{ repetitions: number, easeFactor: number, intervalDays: number, dueDate: string }}
 */
export function nextReviewSchedule(
  { repetitions = 0, easeFactor = 2.5, intervalDays = 0 } = {},
  grade,
  todayKey = getEntryKey(),
) {
  return nextReview(repetitions, easeFactor, intervalDays, grade, todayKey)
}

/** "1 day", "6 days", "2 mo"… for the interval each grade would give. */
export function describeInterval(days) {
  if (days < 30) return `${days} day${days === 1 ? '' : 's'}`
  if (days < 365) return `${Math.round(days / 30)} mo`
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')} yr`
}

const CAP_KEY = 'daily-ink:review-cap'
export const DEFAULT_REVIEW_CAP = 10

export function loadReviewCap() {
  try {
    const value = Number(localStorage.getItem(CAP_KEY))
    return Number.isInteger(value) && value >= 1 && value <= 200 ? value : DEFAULT_REVIEW_CAP
  } catch {
    return DEFAULT_REVIEW_CAP
  }
}

export function saveReviewCap(value) {
  try {
    localStorage.setItem(CAP_KEY, String(value))
  } catch {
    // Storage blocked: the default cap applies.
  }
}

/** How many reviews were graded today (local date). */
export function reviewedToday(reviews, todayKey = getEntryKey()) {
  return Object.values(reviews).filter(
    (review) => review.lastReviewedAt && getEntryKey(new Date(review.lastReviewedAt)) === todayKey,
  ).length
}

export function reviewIsDue(review, todayKey = getEntryKey()) {
  return review.dueDate <= todayKey
}

/**
 * The review queue, oldest first: scheduled reviews that are due, plus
 * entries at least one day old that have never been reviewed.
 */
export function buildDueQueue(entries, reviews, todayKey = getEntryKey()) {
  const pairs = Object.entries(reviews).map(([key, review]) => [key, review.dueDate])
  return dueQueue(Object.keys(entries), pairs, todayKey).map(([dateKey, scheduled]) => ({
    dateKey,
    review: scheduled ? reviews[dateKey] : null,
  }))
}

export function getReviewProgress(reviews) {
  return { total: Object.keys(reviews).length }
}
