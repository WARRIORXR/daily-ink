import { format, isToday, parseISO } from 'date-fns'

export function formatEntryDate(date) {
  const value = date instanceof Date ? date : parseISO(date)
  return format(value, 'EEEE, MMMM d, yyyy')
}

export function formatShortDate(date) {
  const value = date instanceof Date ? date : parseISO(date)
  return format(value, 'MMM d')
}

export function getEntryKey(date = new Date()) {
  return format(date, 'yyyy-MM-dd')
}

export { isToday }
