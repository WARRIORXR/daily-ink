import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEntryContent } from '../hooks/useEntryContent'
import { formatEntryDate, getEntryKey } from '../utils/formatDate'
import { moodByKey } from '../utils/moods'
import { buildDateQuiz } from '../utils/quiz'
import MemoryQuiz from './MemoryQuiz'

function OnThisDayItem({ dateKey, entry, otherKeys, yearsAgo }) {
  const [phase, setPhase] = useState('locked') // locked | quiz | revealed
  const text = useEntryContent(entry)
  const quiz = useMemo(
    () => buildDateQuiz(dateKey, text, otherKeys),
    [dateKey, text, otherKeys],
  )
  const mood = moodByKey(entry?.mood)

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      {/* postcard-style corner ornament */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-accent-soft/60 blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="font-hand text-xl leading-none text-accent">
            {yearsAgo === 0 ? 'On this day' : `${yearsAgo} year${yearsAgo === 1 ? '' : 's'} ago`}
          </p>
          <h3 className="mt-1 font-display text-lg text-ink">{formatEntryDate(dateKey)}</h3>
        </div>
        {/* stamp */}
        <div className="shrink-0 rounded-lg border-2 border-dashed border-clay/50 px-2.5 py-1.5 text-center">
          <span aria-hidden="true" className="block text-lg">
            {mood ? mood.emoji : '✉️'}
          </span>
          <span className="block font-hand text-sm leading-none text-clay">memories</span>
        </div>
      </div>

      {phase === 'locked' && (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-surface-2/40 p-4">
          <p className="text-sm leading-relaxed text-muted">
            A page from your past is waiting. Pass a quick memory check to open it — the surprise
            is part of the practice.
          </p>
          <button
            type="button"
            onClick={() => setPhase('quiz')}
            className="mt-3 rounded-full bg-accent px-4 py-2 text-sm text-on-accent shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            Memory check
          </button>
        </div>
      )}

      {phase === 'quiz' && (
        <div className="mt-5">
          <MemoryQuiz
            prompt={quiz.prompt}
            options={quiz.options}
            correct={quiz.correct}
            onCorrect={() => setPhase('revealed')}
            onReveal={() => setPhase('revealed')}
          />
        </div>
      )}

      {phase === 'revealed' && (
        <div className="animate-fade-in mt-5">
          <p className="drop-cap whitespace-pre-wrap leading-relaxed text-ink">
            {text || 'This page was left empty.'}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <Link
              to={`/journal/${dateKey}`}
              className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-2 hover:underline"
            >
              Open full entry
              <svg
                aria-hidden="true"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </Link>
            <span aria-hidden="true" className="font-hand text-lg text-faint">
              — Daily Ink
            </span>
          </div>
        </div>
      )}
    </article>
  )
}

export default function OnThisDay({ entries }) {
  const todayKey = getEntryKey(new Date())
  const todayMonthDay = todayKey.slice(5) // 'MM-dd'

  const items = useMemo(() => {
    return Object.entries(entries)
      .filter(
        ([dateKey, entry]) =>
          dateKey !== todayKey &&
          dateKey.slice(5) === todayMonthDay &&
          (entry?.content || '').trim().length > 0,
      )
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3)
  }, [entries, todayKey, todayMonthDay])

  if (items.length === 0) return null

  const otherKeys = Object.keys(entries)

  return (
    <section aria-label="On this day" className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl text-ink">On this day</h2>
        <p className="font-hand text-lg text-faint">same date, past years</p>
      </div>
      <div className="space-y-3">
        {items.map(([dateKey, entry]) => (
          <OnThisDayItem
            key={dateKey}
            dateKey={dateKey}
            entry={entry}
            otherKeys={otherKeys}
            yearsAgo={new Date().getFullYear() - parseInt(dateKey.slice(0, 4), 10)}
          />
        ))}
      </div>
    </section>
  )
}