import { addMonths, format, isToday, subMonths } from 'date-fns'
import { useState } from 'react'
import {
  getEntryKey,
  getMonthLabel,
  getMonthWeeks,
  isDayInMonth,
  parseEntryKey,
} from '../utils/formatDate'
import { moodByKey } from '../utils/moods'
import { getRoutinesForDate } from '../utils/routines'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function NavButton({ onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-muted transition hover:border-accent/50 hover:text-accent"
    >
      {children}
    </button>
  )
}

export default function CalendarView({ entries, routines = [], selectedDate, onSelectDate }) {
  const [cursor, setCursor] = useState(() =>
    selectedDate ? parseEntryKey(selectedDate) : new Date(),
  )
  const [handledSelection, setHandledSelection] = useState(selectedDate)

  // Adjust state during render when the selected date changes externally.
  if (selectedDate !== handledSelection) {
    setHandledSelection(selectedDate)
    if (selectedDate) setCursor(parseEntryKey(selectedDate))
  }

  const weeks = getMonthWeeks(cursor)
  const monthPrefix = getEntryKey(cursor).slice(0, 7)
  const writtenThisMonth = Object.entries(entries).filter(
    ([key, entry]) => key.startsWith(monthPrefix) && entry?.content,
  ).length
  const monthKey = getEntryKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1))

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-hand text-lg leading-none text-accent">your memory map</p>
          <h2 className="mt-0.5 font-display text-2xl text-ink">{getMonthLabel(cursor)}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {writtenThisMonth
              ? `${writtenThisMonth} page${writtenThisMonth === 1 ? '' : 's'} written this month`
              : 'No pages this month yet'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <NavButton onClick={() => setCursor((c) => subMonths(c, 1))} label="Previous month">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </NavButton>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted transition hover:border-accent/50 hover:text-accent"
          >
            Today
          </button>
          <NavButton onClick={() => setCursor((c) => addMonths(c, 1))} label="Next month">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </NavButton>
        </div>
      </div>

      {/* Weekday headers */}
      <div
        aria-hidden="true"
        className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-muted"
      >
        {WEEKDAYS.map((day) => (
          <div key={day} className="pb-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid: each day keeps its number on top and its marks in a
          row at the bottom, so nothing can drift outside the cell. */}
      <div key={monthKey} className="grid grid-cols-7 gap-1.5 animate-fade-in">
        {weeks.flat().map((day) => {
          const key = getEntryKey(day)
          const inMonth = isDayInMonth(day, cursor)
          const selected = key === selectedDate
          const todayFlag = isToday(day)
          const entry = entries[key]
          const written = Boolean(entry?.content)
          const mood = moodByKey(entry?.mood)
          const dayRoutines = getRoutinesForDate(routines, key)
          const label = [
            format(day, 'EEEE, MMMM d, yyyy'),
            todayFlag && 'today',
            written && 'has an entry',
            mood && `mood ${mood.label}`,
            dayRoutines.length &&
              `${dayRoutines.length} routine${dayRoutines.length === 1 ? '' : 's'}`,
          ]
            .filter(Boolean)
            .join(', ')

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              aria-label={label}
              aria-pressed={selected}
              className={`group flex h-14 min-w-0 flex-col items-center justify-between overflow-hidden rounded-xl border px-1 py-1.5 text-sm transition duration-150 sm:h-[4.5rem] sm:items-start sm:px-2 ${
                selected
                  ? 'border-accent bg-accent-soft shadow-sm ring-2 ring-accent/40'
                  : written
                    ? 'border-accent/25 bg-accent-soft hover:border-accent/60'
                    : 'border-transparent hover:border-border hover:bg-surface-2'
              } ${inMonth ? 'text-ink' : 'text-faint opacity-60'}`}
            >
              <span
                className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs leading-none sm:text-sm ${
                  todayFlag
                    ? 'bg-accent font-semibold text-on-accent'
                    : selected
                      ? 'font-semibold'
                      : ''
                }`}
              >
                {format(day, 'd')}
              </span>

              <span aria-hidden="true" className="flex h-4 max-w-full items-center gap-0.5">
                {mood ? (
                  <span className="text-xs leading-none sm:text-sm" title={mood.label}>
                    {mood.emoji}
                  </span>
                ) : written ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                ) : null}
                {dayRoutines.slice(0, 3).map((r) => (
                  <span
                    key={r.id}
                    className={`hidden h-1.5 w-1.5 shrink-0 rounded-full sm:block ${
                      r.completions?.includes(key) ? 'opacity-40' : ''
                    }`}
                    style={{ backgroundColor: r.color }}
                  />
                ))}
                {dayRoutines.length > 0 && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full sm:hidden"
                    style={{ backgroundColor: dayRoutines[0].color }}
                  />
                )}
                {dayRoutines.length > 3 && (
                  <span className="hidden text-[10px] leading-none text-muted sm:inline">
                    +{dayRoutines.length - 3}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded border border-accent/25 bg-accent-soft"
          />
          written
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">🙂</span>
          mood
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
          routine
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="grid h-4 w-4 place-items-center rounded-full bg-accent text-[9px] font-semibold text-on-accent"
          >
            {format(new Date(), 'd')}
          </span>
          today
        </span>
      </div>
    </div>
  )
}
