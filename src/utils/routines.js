import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'

export const PRESET_COLORS = [
  { name: 'Amber', hex: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706' },
  { name: 'Sky', hex: '#0284c7', bg: 'rgba(2, 132, 199, 0.15)', text: '#0284c7' },
  { name: 'Emerald', hex: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', text: '#059669' },
  { name: 'Purple', hex: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', text: '#7c3aed' },
  { name: 'Rose', hex: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', text: '#e11d48' },
  { name: 'Indigo', hex: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', text: '#4f46e5' },
  { name: 'Teal', hex: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)', text: '#0d9488' },
]

export const PRESET_ICONS = ['🚿', '🧴', '🪴', '🏃', '💊', '🧺', '📚', '🧹', '🧘', '🌿', '💧', '✨']

/**
 * Checks whether a routine is scheduled on a given dateKey (YYYY-MM-DD).
 */
export function isRoutineScheduledOnDate(routine, dateKey) {
  if (!routine || !dateKey || !routine.startDate) return false
  const interval = Number(routine.gapDays ?? 3) + 1
  if (interval <= 0) return false

  // If already recorded as completed on this exact date, it's an occurrence
  if (routine.completions?.includes(dateKey)) return true

  // Routine hasn't started yet
  if (dateKey < routine.startDate) return false

  // If auto-adjust is enabled and there are completions, project forward from the latest completion
  if (routine.adjustFromLast && routine.completions && routine.completions.length > 0) {
    const sorted = [...routine.completions].sort()
    const lastCompleted = sorted[sorted.length - 1]

    if (dateKey > lastCompleted) {
      const diff = differenceInCalendarDays(parseISO(dateKey), parseISO(lastCompleted))
      return diff > 0 && diff % interval === 0
    }
  }

  // Standard calculation from start date
  const diff = differenceInCalendarDays(parseISO(dateKey), parseISO(routine.startDate))
  return diff >= 0 && diff % interval === 0
}

/**
 * Returns all routines that fall on a specific dateKey.
 */
export function getRoutinesForDate(routines = [], dateKey) {
  return routines.filter((r) => isRoutineScheduledOnDate(r, dateKey))
}

/**
 * Calculates the next upcoming scheduled date on or after `fromDateKey`.
 */
export function getNextScheduledDate(routine, fromDateKey) {
  if (!routine || !fromDateKey) return null
  const fromDate = parseISO(fromDateKey)
  // Check up to 365 days ahead
  for (let i = 0; i <= 365; i++) {
    const candidate = format(addDays(fromDate, i), 'yyyy-MM-dd')
    if (isRoutineScheduledOnDate(routine, candidate)) {
      return candidate
    }
  }
  return null
}

export function formatIntervalSummary(gapDays) {
  const gap = Number(gapDays)
  if (gap === 0) return 'Every day'
  if (gap === 1) return 'Every other day (1 day gap)'
  return `Every ${gap + 1} days (${gap} days gap)`
}
