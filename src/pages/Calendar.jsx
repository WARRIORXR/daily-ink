import { useState } from 'react'
import { Link } from 'react-router-dom'
import CalendarView from '../components/CalendarView'
import EmptyState from '../components/EmptyState'
import { useEntryContent } from '../hooks/useEntryContent'
import { useEntries } from '../hooks/useEntries'
import { formatEntryDate, getEntryKey } from '../utils/formatDate'
import { moodByKey } from '../utils/moods'

export default function Calendar() {
  const { entries, tasks, loading } = useEntries()
  const [selected, setSelected] = useState(getEntryKey(new Date()))

  const selectedEntry = entries[selected]
  const selectedTasks = tasks[selected] ?? []
  const text = useEntryContent(selectedEntry)
  const mood = moodByKey(selectedEntry?.mood)
  const doneCount = selectedTasks.filter((t) => t.done).length

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
  }

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <p className="font-hand text-2xl leading-none text-accent">your memory map</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Calendar</h1>
        <p className="mt-1 text-sm text-muted">Every dot is a day you showed up.</p>
      </header>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <CalendarView
          entries={entries}
          selectedDate={selected}
          onSelectDate={setSelected}
        />
      </div>

      <section aria-label={`Entry for ${formatEntryDate(selected)}`} className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-ink">{formatEntryDate(selected)}</h2>
          <Link
            to={selected === getEntryKey(new Date()) ? '/journal' : `/journal/${selected}`}
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            {selectedEntry ? 'Edit →' : 'Write →'}
          </Link>
        </div>

        {selectedEntry ? (
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              {mood ? (
                <span aria-label={`Mood: ${mood.label}`} className="text-2xl">
                  {mood.emoji}
                </span>
              ) : (
                <span />
              )}
              {selectedTasks.length > 0 && (
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
                  {doneCount}/{selectedTasks.length} tasks done
                </span>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink">
              {text || 'This page was left empty.'}
            </p>
          </div>
        ) : (
          <EmptyState emoji="🕊️" title="Nothing written this day">
            A blank page — ready for your words.
          </EmptyState>
        )}
      </section>
    </div>
  )
}