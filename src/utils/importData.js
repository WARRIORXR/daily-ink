import { addDays } from '../core'
import { MOODS } from './moods'

const MOOD_KEYS = new Set(MOODS.map((m) => m.key))
const MAX_FILE_BYTES = 50 * 1024 * 1024

const isDateKey = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value

/**
 * Validate a Daily Ink JSON export. Returns the entries and tasks keyed by date
 * in the shapes useEntries uses, plus a list of problems with skipped rows.
 * Throws with a readable message when the file isn't a Daily Ink export at all.
 */
export function parseImport(text) {
  if (text.length > MAX_FILE_BYTES)
    throw new Error('That file is too large to import (over 50 MB).')
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.entries)) {
    throw new Error('That file is not a Daily Ink JSON export.')
  }

  const problems = []
  const entries = {}
  data.entries.forEach((row, i) => {
    if (!row || !isDateKey(row.date))
      return problems.push(`Entry ${i + 1}: missing or invalid date`)
    if (typeof row.content !== 'string')
      return problems.push(`Entry ${row.date}: content is not text`)
    if (entries[row.date]) return problems.push(`Entry ${row.date}: duplicate date, kept the first`)
    entries[row.date] = {
      content: row.content,
      mood: MOOD_KEYS.has(row.mood) ? row.mood : null,
      encrypted: row.encrypted === true,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
    }
  })

  const tasks = {}
  const taskRows = Array.isArray(data.tasks) ? data.tasks : []
  taskRows.forEach((row, i) => {
    if (!row || !isDateKey(row.date) || typeof row.title !== 'string' || !row.title.trim()) {
      return problems.push(`Task ${i + 1}: missing date or title`)
    }
    ;(tasks[row.date] ??= []).push({
      title: row.title.slice(0, 500),
      done: row.done === true,
      position: Number.isFinite(row.position) ? row.position : i,
    })
  })
  for (const list of Object.values(tasks)) {
    list.sort((a, b) => a.position - b.position)
    list.forEach((task, index) => (task.position = index))
  }

  return { entries, tasks, problems }
}

/**
 * Combine imported data with what is already there.
 * merge: keep every existing day and add only the days you don't have yet.
 * replace: the imported data becomes the whole journal.
 */
export function combineImport(current, imported, strategy) {
  if (strategy === 'replace') return { entries: imported.entries, tasks: imported.tasks }
  const entries = { ...current.entries }
  const tasks = { ...current.tasks }
  for (const [date, entry] of Object.entries(imported.entries)) {
    if (!entries[date]) entries[date] = entry
  }
  for (const [date, list] of Object.entries(imported.tasks)) {
    if (!tasks[date]?.length && !current.entries[date]) tasks[date] = list
  }
  return { entries, tasks }
}
