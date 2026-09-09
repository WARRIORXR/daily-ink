import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

const KEY_FORMAT = 'yyyy-MM-dd'

export function formatEntryDate(date) {
  const value = date instanceof Date ? date : parseISO(date)
  return format(value, 'EEEE, MMMM d, yyyy')
}

export function formatQuizDate(date) {
  const value = date instanceof Date ? date : parseISO(date)
  return format(value, 'MMM d, yyyy')
}

export function getEntryKey(date = new Date()) {
  return format(date, KEY_FORMAT)
}

export function parseEntryKey(key) {
  return parse(key, KEY_FORMAT, new Date())
}

export function addDaysToKey(key, amount) {
  return format(addDays(parseEntryKey(key), amount), KEY_FORMAT)
}

export function getMonthLabel(date) {
  return format(date, 'MMMM yyyy')
}

/** Weeks (Sunday-first) covering the month containing `date`. */
export function getMonthWeeks(date) {
  const start = startOfWeek(startOfMonth(date))
  const end = endOfWeek(endOfMonth(date))
  return eachDayOfInterval({ start, end }).reduce((weeks, day) => {
    const week = weeks[weeks.length - 1]
    if (!week || week.length === 7) weeks.push([])
    weeks[weeks.length - 1].push(day)
    return weeks
  }, [])
}

export function isDayInMonth(day, month) {
  return isSameMonth(day, month)
}

export { isToday }