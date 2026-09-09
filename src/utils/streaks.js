import { format, parse, subDays } from 'date-fns'

const KEY_FORMAT = 'yyyy-MM-dd'

/**
 * Compute streak statistics from a set of date keys ('yyyy-MM-dd').
 * A streak is alive while yesterday has an entry even if today is still blank.
 */
export function computeStreaks(dateKeys, todayKey = format(new Date(), KEY_FORMAT)) {
  const days = new Set(dateKeys)
  const has = (key) => days.has(key)

  let current = 0
  let cursor = parse(todayKey, KEY_FORMAT, new Date())
  if (!has(format(cursor, KEY_FORMAT))) cursor = subDays(cursor, 1)
  while (has(format(cursor, KEY_FORMAT))) {
    current += 1
    cursor = subDays(cursor, 1)
  }

  const sorted = [...days].sort()
  let longest = 0
  let run = 0
  let prev = null
  for (const key of sorted) {
    if (prev) {
      const diff =
        (parse(key, KEY_FORMAT, new Date()) - parse(prev, KEY_FORMAT, new Date())) / 86_400_000
      run = diff === 1 ? run + 1 : 1
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    prev = key
  }

  return {
    current,
    longest,
    total: days.size,
    missedToday: !has(todayKey),
  }
}