import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { formatEntryDate } from '../utils/formatDate'
import { MOODS, moodByKey } from '../utils/moods'
import { getMoodMap } from '../utils/writing'

const DAYS = 35

export default function MoodMap({ entries, todayKey }) {
  const { days, top } = useMemo(() => getMoodMap(entries, todayKey, DAYS), [entries, todayKey])
  const topMood = moodByKey(top)
  const logged = days.filter((d) => d.mood).length

  return (
    <section
      aria-label="Mood map"
      className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-hand text-lg leading-none text-clay">how you've been feeling</p>
          <h2 className="mt-0.5 font-display text-lg text-ink sm:text-xl">Mood map</h2>
        </div>
        <p className="text-xs text-muted sm:text-sm">
          {topMood
            ? `Mostly ${topMood.label.toLowerCase()} ${topMood.emoji} · ${logged} of ${DAYS} days`
            : 'Pick a mood when you write to fill this in.'}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="grid w-full max-w-72 grid-cols-7 gap-1.5">
          {days.map((day) => {
            const mood = moodByKey(day.mood)
            const label = `${formatEntryDate(day.date)}: ${mood ? mood.label : 'no mood'}`
            return (
              <Link
                key={day.date}
                to={`/journal/${day.date}`}
                title={label}
                aria-label={label}
                className={`aspect-square rounded-md transition hover:scale-110 ${
                  mood ? 'shadow-sm' : 'bg-surface-2'
                } ${day.date === todayKey ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                style={mood ? { backgroundColor: mood.color } : undefined}
              />
            )
          })}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted sm:flex-col">
          {MOODS.map((mood) => (
            <span key={mood.key} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: mood.color }}
              />
              {mood.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
