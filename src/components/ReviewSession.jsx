import { useMemo, useState } from 'react'
import { useEntryContent } from '../hooks/useEntryContent'
import { formatEntryDate } from '../utils/formatDate'
import { moodByKey } from '../utils/moods'
import { buildDateQuiz } from '../utils/quiz'
import MemoryQuiz from './MemoryQuiz'

const GRADES = [
  {
    key: 0,
    label: 'Again',
    hint: '1 day',
    className: 'border-danger/40 text-danger hover:bg-danger/10 hover:border-danger/60',
  },
  {
    key: 1,
    label: 'Hard',
    hint: '3 days',
    className: 'border-accent/40 text-accent hover:bg-accent-soft hover:border-accent/60',
  },
  {
    key: 2,
    label: 'Good',
    hint: '7 days',
    className: 'border-success/40 text-success hover:bg-success/10 hover:border-success/60',
  },
  {
    key: 3,
    label: 'Easy',
    hint: '14 days',
    className: 'border-border text-ink hover:bg-surface-2 hover:border-faint',
  },
]

export default function ReviewSession({ dateKey, entry, otherKeys, index, total, onGrade }) {
  const [phase, setPhase] = useState('quiz') // quiz | entry
  const text = useEntryContent(entry)
  const quiz = useMemo(
    () => buildDateQuiz(dateKey, text, otherKeys),
    [dateKey, text, otherKeys],
  )
  const mood = moodByKey(entry?.mood)
  const pct = ((index + 1) / total) * 100

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <p className="font-hand text-2xl text-accent">memory {index + 1} of {total}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-faint">spaced review</p>
      </div>

      <div
        aria-hidden="true"
        className="mb-6 h-2 overflow-hidden rounded-full border border-border bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-clay transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-accent-soft/70 blur-3xl"
        />

        {phase === 'quiz' && (
          <div className="relative">
            <MemoryQuiz
              prompt={quiz.prompt}
              options={quiz.options}
              correct={quiz.correct}
              onCorrect={() => setPhase('entry')}
              onReveal={() => setPhase('entry')}
            />
          </div>
        )}

        {phase === 'entry' && (
          <div className="relative animate-fade-in space-y-6">
            <header className="text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-accent">A page from</p>
              <h2 className="mt-1 font-display text-2xl text-ink">{formatEntryDate(dateKey)}</h2>
              {mood ? (
                <span
                  aria-label={`Mood: ${mood.label}`}
                  className="mt-2 inline-grid h-10 w-10 place-items-center rounded-full bg-clay-soft text-xl"
                >
                  {mood.emoji}
                </span>
              ) : null}
              <div
                aria-hidden="true"
                className="mx-auto mt-3 flex items-center justify-center gap-2 text-faint"
              >
                <span className="h-px w-16 bg-border" />
                <span className="text-xs">✦</span>
                <span className="h-px w-16 bg-border" />
              </div>
            </header>

            <p className="drop-cap whitespace-pre-wrap leading-relaxed text-ink">
              {text || 'This page was left empty.'}
            </p>

            <fieldset>
              <legend className="text-sm text-muted">
                How well did you remember it? This sets the next review date.
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADES.map((grade) => (
                  <button
                    key={grade.key}
                    type="button"
                    onClick={() => onGrade(grade.key)}
                    className={`rounded-xl border bg-surface px-3 py-3 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${grade.className}`}
                  >
                    <span className="block font-display font-medium">{grade.label}</span>
                    <span className="block text-xs opacity-70">{grade.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>
    </div>
  )
}