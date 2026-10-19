import { Link } from 'react-router-dom'

export default function StreakBadge({ current, missedToday }) {
  const ring = current === 0 ? 0 : Math.min((current % 7) / 7, 1) * 360

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
      {/* soft glow + decorative dots */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent-soft blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(circle_at_20%_120%,var(--accent-soft),transparent_60%)]"
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          {/* flame medallion with streak ring */}
          <div
            className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full p-[3px]"
            style={{
              background: `conic-gradient(var(--accent) ${ring}deg, var(--surface-2) ${ring}deg 360deg)`,
            }}
          >
            <div className="grid h-full w-full place-items-center rounded-full bg-surface text-3xl">
              <span aria-hidden="true" className="animate-float">
                🔥
              </span>
            </div>
          </div>
          <div className="min-w-0">
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
                  ? 'Write today to keep the flame alive.'
                  : 'The ink is warm today — nice work.'}
            </p>
          </div>
        </div>

        {missedToday && (
          <Link
            to="/journal"
            className="shrink-0 self-start rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 sm:self-center"
          >
            Write today
          </Link>
        )}
      </div>
    </div>
  )
}