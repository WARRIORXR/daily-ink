import { formatEntryDate } from './formatDate'

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type: mime }))
}

export function buildJSONExport(entries, tasks, reviews) {
  return {
    app: 'Daily Ink',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: Object.entries(entries)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entry]) => ({
        date,
        content: entry.content,
        mood: entry.mood ?? null,
        encrypted: entry.encrypted ?? false,
        createdAt: entry.createdAt ?? null,
        updatedAt: entry.updatedAt ?? null,
      })),
    tasks: Object.entries(tasks).flatMap(([date, list]) =>
      list.map((task) => ({
        date,
        title: task.title,
        done: task.done,
        position: task.position,
      })),
    ),
    reviews: Object.entries(reviews)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, review]) => ({
        date,
        intervalDays: review.intervalDays,
        easeFactor: review.easeFactor,
        repetitions: review.repetitions,
        dueDate: review.dueDate,
        lastReviewedAt: review.lastReviewedAt ?? null,
      })),
  }
}

export function buildMarkdownExport(entries, tasks) {
  const lines = []
  for (const [date, entry] of Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`# ${formatEntryDate(date)}`)
    const mood = entry.mood ? `\n> Mood: ${entry.mood}\n` : ''
    if (mood) lines.push(mood.trim())
    lines.push('')
    lines.push(entry.content || '_No text written._')
    const dayTasks = tasks[date]
    if (dayTasks?.length) {
      lines.push('')
      lines.push('**Tasks**')
      for (const task of dayTasks) {
        lines.push(`- [${task.done ? 'x' : ' '}] ${task.title}`)
      }
    }
    lines.push('', '---', '')
  }
  return lines.join('\n')
}