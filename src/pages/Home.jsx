import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import OnThisDay from '../components/OnThisDay'
import StatsCards from '../components/StatsCards'
import StreakBadge from '../components/StreakBadge'
import { useEntries } from '../hooks/useEntries'
import { useReviews } from '../hooks/useReviews'
import { useRoutines } from '../hooks/useRoutines'
import { useToday } from '../hooks/useToday'
import { computeStreaks } from '../utils/streaks'
import { buildDueQueue } from '../utils/spacedRepetition'
import { getRoutinesForDate } from '../utils/routines'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Still up, night owl?'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const today = useToday()
  const { entries, loading } = useEntries()
  const { reviews } = useReviews()
  const { routines, toggleCompletion } = useRoutines()

  const todayRoutines = getRoutinesForDate(routines, today.key)

  const stats = useMemo(() => {
    const streaks = computeStreaks(Object.keys(entries), today.key)
    const due = buildDueQueue(entries, reviews, today.key)
    return {
      current: streaks.current,
      longest: streaks.longest,
      total: streaks.total,
      missedToday: streaks.missedToday,
      dueCount: due.length,
    }
  }, [entries, reviews, today.key])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-56 animate-pulse rounded-full bg-surface-2" />
        <div className="h-32 animate-pulse rounded-3xl bg-surface-2" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-surface-2"
            />
          ))}
        </div>
      </div>
    )
  }

  const hasEntry = Boolean(entries[today.key])

  return (
    <div className="animate-fade-up space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <p className="font-hand text-2xl sm:text-3xl text-accent">{greeting()}</p>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl leading-tight text-ink tracking-tight">
          {today.label}
        </h1>
        <div
          aria-hidden="true"
          className="mt-3 h-px w-20 sm:w-24 bg-gradient-to-r from-accent/60 to-transparent"
        />
        <p className="mt-3 max-w-lg text-base sm:text-lg leading-relaxed text-muted">
          One page a day. Quiet, private, and yours.
        </p>
      </header>

      {/* Streak */}
      <StreakBadge current={stats.current} missedToday={stats.missedToday} />

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Today's Routines */}
      {todayRoutines.length > 0 && (
        <section
          aria-label="Routines due today"
          className="rounded-2xl border border-accent/20 bg-surface p-4 sm:p-5 shadow-card space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <h2 className="font-display text-base sm:text-lg text-ink">
                Routines Due Today
              </h2>
            </div>
            <Link
              to="/calendar"
              className="text-xs font-medium text-accent hover:underline"
            >
              All routines
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {todayRoutines.map((routine) => {
              const isCompleted = routine.completions?.includes(today.key)
              return (
                <button
                  key={routine.id}
                  onClick={() => toggleCompletion(routine.id, today.key)}
                  className={`flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border text-left transition cursor-pointer select-none ${
                    isCompleted
                      ? 'border-success/30 bg-success/5'
                      : 'border-border bg-surface-2 hover:border-accent/40 hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg flex-shrink-0">
                      {routine.icon || '✨'}
                    </span>
                    <span
                      className={`text-sm font-medium truncate ${
                        isCompleted ? 'line-through text-muted' : 'text-ink'
                      }`}
                    >
                      {routine.title}
                    </span>
                  </div>
                  <span
                    className={`flex h-6 w-6 shrink-0 grid place-items-center rounded-full border text-xs font-medium transition ${
                      isCompleted
                        ? 'border-success bg-success text-white'
                        : 'border-border text-faint hover:border-accent hover:text-accent'
                    }`}
                  >
                    {isCompleted ? '✓' : '+'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Primary actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Write */}
        <Link
          to="/journal"
          className={`group relative overflow-hidden rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-card ${
            hasEntry
              ? 'border-accent/40 bg-accent-soft hover:border-accent hover:shadow-pop'
              : 'border-accent bg-accent-soft hover:border-accent hover:shadow-pop'
          }`}
        >
          <p className="font-display text-lg sm:text-xl text-ink">
            {hasEntry ? "Continue today's page" : "Write today's page"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {hasEntry
              ? "You've written something already — pick up where you left off."
              : 'Start with a few lines — no pressure.'}
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
            Open journal
            <svg
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </span>
        </Link>

        {/* Review */}
        <Link
          to="/review"
          className="group rounded-2xl border border-border bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-pop"
        >
          <p className="font-display text-lg sm:text-xl text-ink">Review memories</p>
          <p className="mt-1 text-sm text-muted">
            {stats.dueCount === 0
              ? 'All caught up — your memories are warm.'
              : `${stats.dueCount} memory${stats.dueCount === 1 ? '' : 'ies'} ready to revisit.`}
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent">
            {stats.dueCount === 0 ? 'See past pages' : 'Start review'}
            <svg
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </span>
        </Link>
      </div>

      {/* On this day */}
      <OnThisDay entries={entries} />
    </div>
  )
}
