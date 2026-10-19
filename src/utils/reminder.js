// Opt-in daily writing reminder. Everything stays on the device: the Notifications
// API shows the message locally, so it only fires while Daily Ink is open (a tab,
// or the installed app running in the background).
import { getEntryKey } from './formatDate'

const KEY = 'daily-ink:reminder'
const LAST_KEY = 'daily-ink:reminder-last'
export const DEFAULT_REMINDER = { enabled: false, time: '20:00' }

export const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window

export function loadReminder() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (saved && typeof saved.enabled === 'boolean' && /^\d\d:\d\d$/.test(saved.time)) return saved
  } catch {
    // fall through to the default
  }
  return DEFAULT_REMINDER
}

export function saveReminder(reminder) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reminder))
  } catch {
    // storage unavailable: the setting lasts for this visit only
  }
  window.dispatchEvent(new Event('daily-ink:reminder'))
}

/** Asks for permission; resolves to true when notifications may be shown. */
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

// Whether today's page has words, as last seen by any page that loaded entries.
// Unknown means no reminder: better silent than wrong.
let todayStatus = { date: null, written: false }

export function noteEntries(entries, now = new Date()) {
  const date = getEntryKey(now)
  todayStatus = { date, written: Boolean(entries[date]?.content?.trim()) }
}

export function wroteToday(now = new Date()) {
  return todayStatus.date === getEntryKey(now) ? todayStatus.written : null
}

/** True when the reminder should fire now: past the chosen time, not yet sent today, page still blank. */
export function reminderDue(reminder, now, written, lastSent) {
  if (!reminder.enabled || written !== false) return false
  const today = getEntryKey(now)
  if (lastSent === today) return false
  const [h, m] = reminder.time.split(':').map(Number)
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m
}

export function lastReminderSent() {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

export async function showReminder(now = new Date()) {
  try {
    localStorage.setItem(LAST_KEY, getEntryKey(now))
  } catch {
    // ignore
  }
  const title = 'Daily Ink'
  const options = {
    body: 'Today’s page is still blank. A few lines is enough.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'daily-ink-reminder',
    data: { url: '/journal' },
  }
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null)
  if (reg) return reg.showNotification(title, options)
  new Notification(title, options)
}
