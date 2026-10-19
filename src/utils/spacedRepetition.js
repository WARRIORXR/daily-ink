import { dueQueue, nextReview } from '../core'
import { getEntryKey } from './formatDate'

/**
 * Advance a review schedule given a self-grade (computed in Rust).
 * grade: 0 = again, 1 = hard, 2 = good, 3 = easy
 * @returns {{ repetitions: number, easeFactor: number, intervalDays: number, dueDate: string }}
 */
export function nextReviewSchedule(
  { repetitions = 0, easeFactor = 2.5 } = {},
  grade,
  todayKey = getEntryKey(),
) {
  return nextReview(repetitions, easeFactor, grade, todayKey)
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
