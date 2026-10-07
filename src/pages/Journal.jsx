import { useNavigate, useParams } from 'react-router-dom'
import EntryEditor from '../components/EntryEditor'
import PageHeader from '../components/PageHeader'
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
      <PageHeader
        eyebrow={isToday ? 'today’s page' : 'a page from the past'}
        title={formatEntryDate(dateKey)}
        actions={
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only sm:not-sr-only">Jump to date</span>
            <input
              type="date"
              value={dateKey}
              max={today.key}
              onChange={(event) => changeDate(event.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none ring-accent/30 focus:ring-4 sm:w-auto"
            />
          </label>
        }
      />

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