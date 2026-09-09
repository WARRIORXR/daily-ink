import { useNavigate, useParams } from 'react-router-dom'
import EntryEditor from '../components/EntryEditor'
import { useToday } from '../hooks/useToday'
import { formatEntryDate, getEntryKey, parseEntryKey } from '../utils/formatDate'

export default function Journal() {
  const { date } = useParams()
  const today = useToday()
  const navigate = useNavigate()

  const dateKey = date ?? today.key
  const isToday = dateKey === today.key

  function changeDate(value) {
    if (!value) return
    const key = getEntryKey(new Date(`${value}T12:00:00`))
    navigate(key === today.key ? '/journal' : `/journal/${key}`)
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-hand text-2xl leading-none text-accent">
            {isToday ? 'today’s page' : 'a page from the past'}
          </p>
          <h1 className="mt-1 font-display text-3xl text-ink">{formatEntryDate(dateKey)}</h1>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only sm:not-sr-only">Jump to date</span>
          <input
            type="date"
            value={dateKey}
            max={today.key}
            onChange={(event) => changeDate(event.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none ring-accent/30 focus:ring-4"
          />
        </label>
      </div>

      {parseEntryKey(dateKey) > new Date() ? (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          That date hasn’t happened yet — the future can wait.
        </p>
      ) : (
        <EntryEditor key={dateKey} dateKey={dateKey} />
      )}
    </div>
  )
}