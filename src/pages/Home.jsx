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
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-up space-y-8">
      <header className="relative">
        <p className="font-hand text-2xl text-accent">{greeting()}</p>
        <h1 className="mt-1 font-display text-4xl leading-tight text-ink sm:text-5xl">
          {today.label}
        </h1>
        <div
          aria-hidden="true"
          className="mt-4 h-px w-24 bg-gradient-to-r from-accent/70 to-transparent"
        />
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted">
          One page a day. Quiet, private, and yours.
        </p>
      </header>

      <StreakBadge current={stats.current} missedToday={stats.missedToday} />

      <StatsCards stats={stats} />

      {/* Today's Routines */}
      {todayRoutines.length > 0 && (
        <section aria-label="Routines due today" className="rounded-2xl border border-accent/30 bg-surface p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <h2 className="font-display text-lg text-ink">Routines Due Today</h2>
            </div>
            <Link to="/calendar" className="text-xs font-medium text-accent hover:underline">
              View Calendar →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {todayRoutines.map((routine) => {
              const isCompleted = routine.completions?.includes(today.key)
              return (
                <div
                  key={routine.id}
                  onClick={() => toggleCompletion(routine.id, today.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleCompletion(routine.id, today.key)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer select-none ${
                    isCompleted
                      ? 'border-success/30 bg-success/5 text-muted'
                      : 'border-border bg-surface-2 hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">{routine.icon || '✨'}</span>
                    <span className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-muted' : 'text-ink'}`}>
                      {routine.title}
                    </span>
                  </div>
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] transition ${
                      isCompleted ? 'border-success bg-success text-white' : 'border-border'
                    }`}
                  >
                    {isCompleted && '✓'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/journal"
          className="group relative overflow-hidden rounded-2xl border border-accent/40 bg-accent-soft p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-card"
        >
          <p className="font-display text-lg text-ink">Write today’s page</p>
          <p className="mt-1 text-sm text-muted">
            {entries[today.key] ? 'Continue what you started.' : 'Start with a few lines.'}
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent">
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

        <Link
          to="/review"
          className="group rounded-2xl border border-border bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-pop"
        >
          <p className="font-display text-lg text-ink">Review memories</p>
          <p className="mt-1 text-sm text-muted">
            {stats.dueCount === 0
              ? 'All caught up — your memories are warm.'
              : `${stats.dueCount} memory${stats.dueCount === 1 ? '' : 'ies'} waiting to be revisited.`}
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent">
            {stats.dueCount === 0 ? 'Browse past pages' : 'Start review'}
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

      <OnThisDay entries={entries} />
    </div>
  )
}