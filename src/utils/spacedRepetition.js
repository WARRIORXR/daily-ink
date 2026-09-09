import { addDays, format, parse } from 'date-fns'

const KEY_FORMAT = 'yyyy-MM-dd'
const MIN_EASE = 1.3

// SM-2-ish ladder. The first review of an entry lands on the grade's own
// interval (again 1d / hard 3d / good 7d / easy 14d); later reviews climb.
const INTERVALS = [1, 3, 7, 14, 30, 60, 120, 240]

/**
 * Advance a review schedule given a self-grade.
 * grade: 0 = again, 1 = hard, 2 = good, 3 = easy
 */
export function nextReviewSchedule({ repetitions = 0, easeFactor = 2.5 } = {}, grade) {
  let reps = repetitions
  let ef = easeFactor

  if (grade === 0) {
    reps = 0
    ef = Math.max(MIN_EASE, ef - 0.2)
  } else if (grade === 1) {
    reps = Math.max(reps + 1, 1)
    ef = Math.max(MIN_EASE, ef - 0.15)
  } else if (grade === 2) {
    reps = Math.max(reps + 1, 2)
  } else {
    reps = Math.max(reps + 1, 3)
    ef += 0.15
  }

  const intervalDays = INTERVALS[Math.min(reps, INTERVALS.length - 1)]
  const dueDate = format(addDays(new Date(), intervalDays), KEY_FORMAT)
  return { repetitions: reps, easeFactor: Number(ef.toFixed(2)), intervalDays, dueDate }
}

export function reviewIsDue(review, todayKey = format(new Date(), KEY_FORMAT)) {
  return review.dueDate <= todayKey
}

/**
 * Build the review queue: scheduled reviews that are due, plus entries that are
 * at least one day old and have never been reviewed.
 */
export function buildDueQueue(entries, reviews, todayKey = format(new Date(), KEY_FORMAT)) {
  const queue = []

  for (const [dateKey, review] of Object.entries(reviews)) {
    if (review.dueDate <= todayKey) queue.push({ dateKey, review })
  }

  for (const dateKey of Object.keys(entries)) {
    if (dateKey >= todayKey) continue // today/future not due yet
    if (reviews[dateKey]) continue
    queue.push({ dateKey, review: null })
  }

  // Oldest first so early memories surface first.
  queue.sort((a, b) => parse(a.dateKey, KEY_FORMAT, new Date()) - parse(b.dateKey, KEY_FORMAT, new Date()))
  return queue
}

export function getReviewProgress(reviews) {
  const total = Object.keys(reviews).length
  return { total }
}