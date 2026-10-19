import { Link } from 'react-router-dom'

export default function StreakBadge({ current, missedToday }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-y border-border py-6">
      <div>
        <p className="font-display text-5xl leading-none text-ink">
          {current}
          <span className="ml-2 align-middle font-sans text-base text-muted">
            day{current === 1 ? '' : 's'} in a row
          </span>
        </p>
        <p className="mt-2 text-sm text-muted">
          {current === 0
            ? 'Every streak starts with one page.'
            : missedToday
              ? 'Write today to keep it going.'
              : 'Today is written.'}
        </p>
      </div>

      {missedToday && (
        <Link
          to="/journal"
          className="rounded-xl bg-accent px-4 py-2 text-sm text-on-accent transition hover:opacity-90"
        >
          Write today
        </Link>
      )}
    </div>
  )
}
