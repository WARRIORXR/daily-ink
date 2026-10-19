import { useEffect, useMemo, useRef } from 'react'
import { formatEntryDate, parseEntryKey } from '../utils/formatDate'
import { buildHeatmap } from '../utils/streaks'

const SHADES = {
  0: 'bg-surface-2',
  1: 'bg-accent/25',
  2: 'bg-accent/50',
  3: 'bg-accent/75',
  4: 'bg-accent',
  5: 'bg-sky-400/70',
}
const LABELS = {
  0: 'nothing written',
  1: 'a few lines',
  2: 'a short page',
  3: 'a full page',
  4: 'a long page',
  5: 'covered by a freeze',
}
const DAY_NAMES = ['Mon', '', 'Wed', '', 'Fri', '', '']

/** Last 12 months of writing, one square per day, Monday-first weeks. */
export default function YearHeatmap({ entries, frozen, todayKey }) {
  const cells = useMemo(() => buildHeatmap(entries, frozen, todayKey), [entries, frozen, todayKey])
  const scroller = useRef(null)

  // On narrow screens start scrolled to the most recent weeks.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [cells])

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  const written = cells.filter((c) => c.level >= 1 && c.level <= 4).length

  return (
    <section
      aria-label="Writing over the last 12 months"
      className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-hand text-lg leading-none text-accent">a year of pages</p>
          <h2 className="mt-0.5 font-display text-lg text-ink sm:text-xl">Last 12 months</h2>
        </div>
        <p className="text-xs text-muted sm:text-sm">
          {written} {written === 1 ? 'day' : 'days'} written
        </p>
      </div>

      {/* A picture of the year: one tab stop for the whole grid, not one per day. */}
      <div
        ref={scroller}
        role="img"
        aria-label={`Writing heatmap: ${written} of the last ${cells.filter((c) => c.level >= 0).length} days written.`}
        className="no-scrollbar mt-4 overflow-x-auto pb-1"
      >
        <div aria-hidden="true" className="flex w-max gap-[3px]">
          <div className="mr-1 grid grid-rows-7 gap-[3px] pt-4 text-[10px] leading-[11px] text-faint">
            {DAY_NAMES.map((name, i) => (
              <span key={i} className="h-[11px]">
                {name}
              </span>
            ))}
          </div>
          {weeks.map((week) => {
            const first = parseEntryKey(week[0].date)
            const showMonth = first.getDate() <= 7
            return (
              <div key={week[0].date} className="relative grid grid-rows-7 gap-[3px] pt-4">
                {showMonth ? (
                  <span className="absolute left-0 top-0 text-[10px] leading-none text-faint">
                    {first.toLocaleDateString(undefined, { month: 'short' })}
                  </span>
                ) : null}
                {week.map((cell) =>
                  cell.level < 0 ? (
                    <span key={cell.date} className="h-[11px] w-[11px]" />
                  ) : (
                    <span
                      key={cell.date}
                      title={`${formatEntryDate(cell.date)}: ${LABELS[cell.level]}`}
                      className={`h-[11px] w-[11px] rounded-[3px] ${SHADES[cell.level]} ${
                        cell.date === todayKey ? 'ring-1 ring-ink/60' : ''
                      }`}
                    />
                  ),
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              aria-hidden="true"
              className={`h-[11px] w-[11px] rounded-[3px] ${SHADES[level]}`}
            />
          ))}
          More
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className={`h-[11px] w-[11px] rounded-[3px] ${SHADES[5]}`} />
          Freeze day
        </span>
      </div>
    </section>
  )
}
