import { Link } from 'react-router-dom'
import { useEntryContent } from '../hooks/useEntryContent'
import { formatEntryDate } from '../utils/formatDate'
import { moodByKey } from '../utils/moods'

export default function EntryCard({ dateKey, entry, tasks = [], compact = false }) {
  const text = useEntryContent(entry)
  const mood = moodByKey(entry?.mood)
  const doneCount = tasks.filter((t) => t.done).length

  return (
    <Link
      to={`/journal/${dateKey}`}
      className="group block rounded-2xl border border-border bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-pop"
    >
      <div className="flex items-center gap-3">
        {mood ? (
          <span
            aria-label={`Mood: ${mood.label}`}
            title={mood.label}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-lg"
          >
            {mood.emoji}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-lg"
          >
            📄
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-accent">{formatEntryDate(dateKey)}</p>
          {tasks.length > 0 && (
            <p className="text-xs text-faint">
              {doneCount}/{tasks.length} tasks done
            </p>
          )}
        </div>
        <svg
          aria-hidden="true"
          className="shrink-0 text-faint transition duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
      <p
        className={`mt-3 whitespace-pre-wrap text-ink ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}
      >
        {text || <span className="text-faint">Empty page</span>}
      </p>
    </Link>
  )
}