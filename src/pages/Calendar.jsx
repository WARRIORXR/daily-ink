import { useState } from 'react'
import { Link } from 'react-router-dom'
import CalendarView from '../components/CalendarView'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import RoutineModal from '../components/RoutineModal'
import { useEntries } from '../hooks/useEntries'
import { useEntryContent } from '../hooks/useEntryContent'
import { useRoutines } from '../hooks/useRoutines'
import { formatEntryDate, getEntryKey } from '../utils/formatDate'
import { moodByKey } from '../utils/moods'
import { formatIntervalSummary, getRoutinesForDate } from '../utils/routines'

export default function Calendar() {
  const { entries, tasks, loading: entriesLoading } = useEntries()
  const { routines, addRoutine, deleteRoutine, toggleCompletion, loading: routinesLoading } = useRoutines()
  const [selected, setSelected] = useState(getEntryKey(new Date()))
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false)

  const selectedEntry = entries[selected]
  const selectedTasks = tasks[selected] ?? []
  const text = useEntryContent(selectedEntry)
  const mood = moodByKey(selectedEntry?.mood)
  const doneCount = selectedTasks.filter((t) => t.done).length

  const dayRoutines = getRoutinesForDate(routines, selected)
  const completedRoutinesCount = dayRoutines.filter((r) => r.completions?.includes(selected)).length

  if (entriesLoading && routinesLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="your memory map"
        title="Calendar"
        description="Entries, streaks, and spaced routines at a glance."
        actions={
          <button
            type="button"
            onClick={() => setIsRoutineModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-ink shadow-sm transition hover:border-accent/40 hover:bg-surface-2 sm:text-sm"
          >
            <span aria-hidden="true">✨</span>
            <span>Routines &amp; Intervals</span>
            {routines.length > 0 && (
              <span className="ml-1 rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent">
                {routines.length}
              </span>
            )}
          </button>
        }
      />

      {/* Monthly Calendar View */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <CalendarView
          entries={entries}
          routines={routines}
          selectedDate={selected}
          onSelectDate={setSelected}
        />
      </div>

      {/* Routines for Selected Date */}
      <section aria-label={`Routines for ${formatEntryDate(selected)}`} className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <h2 className="font-display text-lg text-ink">Routines on {formatEntryDate(selected).split(',')[0]}</h2>
            {dayRoutines.length > 0 && (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
                {completedRoutinesCount}/{dayRoutines.length} done
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsRoutineModalOpen(true)}
            className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
          >
            + Add Routine
          </button>
        </div>

        {dayRoutines.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dayRoutines.map((routine) => {
              const isCompleted = routine.completions?.includes(selected)
              return (
                <div
                  key={routine.id}
                  onClick={() => toggleCompletion(routine.id, selected)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleCompletion(routine.id, selected)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                    isCompleted
                      ? 'border-success/30 bg-success/5 dark:bg-success/10'
                      : 'border-border bg-surface hover:border-accent/40 shadow-card'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg shadow-sm"
                      style={{ backgroundColor: `${routine.color}20`, color: routine.color }}
                    >
                      {routine.icon || '✨'}
                    </span>
                    <div className="min-w-0">
                      <p className={`font-medium text-sm truncate ${isCompleted ? 'line-through text-muted' : 'text-ink'}`}>
                        {routine.title}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {formatIntervalSummary(routine.gapDays)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full border transition ${
                        isCompleted
                          ? 'border-success bg-success text-white'
                          : 'border-border bg-surface hover:border-accent'
                      }`}
                    >
                      {isCompleted && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-2xl border border-dashed border-border bg-surface/40 p-4 text-xs text-muted">
            <span>No routines due on this day.</span>
            <button
              type="button"
              onClick={() => setIsRoutineModalOpen(true)}
              className="text-accent font-medium hover:underline"
            >
              Schedule one →
            </button>
          </div>
        )}
      </section>

      {/* Journal Entry Section */}
      <section aria-label={`Entry for ${formatEntryDate(selected)}`} className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-ink">{formatEntryDate(selected)}</h2>
          <Link
            to={selected === getEntryKey(new Date()) ? '/journal' : `/journal/${selected}`}
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            {selectedEntry ? 'Edit Entry →' : 'Write Entry →'}
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

      {/* Routines Management Modal */}
      <RoutineModal
        open={isRoutineModalOpen}
        onClose={() => setIsRoutineModalOpen(false)}
        routines={routines}
        onAddRoutine={addRoutine}
        onDeleteRoutine={deleteRoutine}
        initialDate={selected}
      />
    </div>
  )
}