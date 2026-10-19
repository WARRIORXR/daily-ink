import { intervalSummary, nextRoutineDate, routineOn } from '../core'

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

const gapOf = (routine) => Number(routine.gapDays ?? 3)

/** Whether a routine falls on a dateKey (YYYY-MM-DD). Computed in Rust. */
export function isRoutineScheduledOnDate(routine, dateKey) {
  if (!routine || !dateKey || !routine.startDate) return false
  const completions = routine.completions ?? []
  const gap = gapOf(routine)
  if (!Number.isFinite(gap)) return completions.includes(dateKey)
  return routineOn(routine.startDate, Math.trunc(gap), Boolean(routine.adjustFromLast), completions, dateKey)
}

/** All routines that fall on a specific dateKey. */
export function getRoutinesForDate(routines = [], dateKey) {
  return routines.filter((r) => isRoutineScheduledOnDate(r, dateKey))
}

/** Next scheduled date on or after `fromDateKey`, up to a year ahead. */
export function getNextScheduledDate(routine, fromDateKey) {
  if (!routine || !fromDateKey || !routine.startDate) return null
  const gap = gapOf(routine)
  if (!Number.isFinite(gap)) return null
  return (
    nextRoutineDate(
      routine.startDate,
      Math.trunc(gap),
      Boolean(routine.adjustFromLast),
      routine.completions ?? [],
      fromDateKey,
    ) ?? null
  )
}

export function formatIntervalSummary(gapDays) {
  return intervalSummary(Math.trunc(Number(gapDays)) || 0)
}
