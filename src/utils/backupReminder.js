const LAST_EXPORT_KEY = 'daily-ink:last-export'
const SNOOZE_KEY = 'daily-ink:backup-snooze'
const DAY_MS = 24 * 60 * 60 * 1000
export const BACKUP_INTERVAL_DAYS = 14

function readTime(key) {
  try {
    const value = Date.parse(localStorage.getItem(key) ?? '')
    return Number.isNaN(value) ? null : value
  } catch {
    return null
  }
}

function writeTime(key, date) {
  try {
    localStorage.setItem(key, date.toISOString())
  } catch {
    // Storage blocked or full: the reminder simply shows again later.
  }
}

export function recordExport() {
  writeTime(LAST_EXPORT_KEY, new Date())
}

export function snoozeBackupReminder(days = 3) {
  writeTime(SNOOZE_KEY, new Date(Date.now() + days * DAY_MS))
}

/** Days since the last export (null if never), or false when no reminder is due. */
export function backupReminderDue(hasEntries, now = Date.now()) {
  if (!hasEntries) return false
  const snoozedUntil = readTime(SNOOZE_KEY)
  if (snoozedUntil && snoozedUntil > now) return false
  const last = readTime(LAST_EXPORT_KEY)
  if (last && now - last < BACKUP_INTERVAL_DAYS * DAY_MS) return false
  return { daysSince: last ? Math.floor((now - last) / DAY_MS) : null }
}
