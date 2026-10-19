import { useEffect } from 'react'
import {
  lastReminderSent,
  loadReminder,
  notificationsSupported,
  reminderDue,
  showReminder,
  wroteToday,
} from '../utils/reminder'

/** Checks every half minute whether today's reminder is due and shows it once. */
export function useDailyReminder() {
  useEffect(() => {
    if (!notificationsSupported()) return undefined
    const check = () => {
      if (Notification.permission !== 'granted') return
      const now = new Date()
      if (reminderDue(loadReminder(), now, wroteToday(now), lastReminderSent())) {
        showReminder(now).catch(() => {})
      }
    }
    check()
    const timer = window.setInterval(check, 30_000)
    window.addEventListener('daily-ink:reminder', check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('daily-ink:reminder', check)
    }
  }, [])
}
