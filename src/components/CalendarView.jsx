import { addMonths, format, isToday, subMonths } from 'date-fns'
import { useState } from 'react'
import { getEntryKey, getMonthLabel, getMonthWeeks, isDayInMonth, parseEntryKey } from '../utils/formatDate'

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

export default function CalendarView({ entries, selectedDate, onSelectDate }) {
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
  const hasEntry = (day) => Boolean(entries[getEntryKey(day)])
  const monthKey = getEntryKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-hand text-lg leading-none text-accent">your memory map</p>
          <h2 className="mt-0.5 font-display text-2xl text-ink">{getMonthLabel(cursor)}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <NavButton onClick={() => setCursor((c) => subMonths(c, 1))} label="Previous month">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </NavButton>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-faint">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div key={monthKey} className="grid grid-cols-7 gap-1 animate-fade-in">
        {weeks.flat().map((day) => {
          const key = getEntryKey(day)
          const inMonth = isDayInMonth(day, cursor)
          const selected = key === selectedDate
          const today = isToday(day)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              aria-label={format(day, 'EEEE, MMMM d, yyyy')}
              aria-pressed={selected}
              className={`group relative flex aspect-square items-center justify-center rounded-xl text-sm transition duration-150 ${
                inMonth ? 'text-ink' : 'text-faint/40'
              } ${
                selected
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'hover:bg-surface-2'
              } ${today && !selected ? 'ring-1 ring-inset ring-accent/50' : ''}`}
            >
              {format(day, 'd')}
              {hasEntry(day) && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full transition ${
                    selected ? 'bg-on-accent' : 'bg-accent group-hover:scale-125'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" /> has an entry
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded ring-1 ring-inset ring-accent/60" /> today
        </span>
      </div>
    </div>
  )
}