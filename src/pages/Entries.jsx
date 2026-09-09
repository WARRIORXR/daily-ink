import { Link } from 'react-router-dom'
import { useLocalEntries } from '../hooks/useLocalEntries'
import { formatEntryDate } from '../utils/formatDate'

export default function Entries() {
  const { entries } = useLocalEntries()
  const days = Object.keys(entries).sort((a, b) => b.localeCompare(a))

  if (days.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="font-display text-3xl text-stone-900">Past entries</h1>
        <p className="text-stone-600">No pages yet. Start with today.</p>
        <Link to="/journal" className="inline-block text-sm text-accent underline">
          Write today
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl text-stone-900">Past entries</h1>
      <ul className="space-y-3">
        {days.map((key) => (
          <li key={key} className="rounded-2xl border border-stone-200 bg-white/70 p-5">
            <p className="text-sm text-accent">{formatEntryDate(key)}</p>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-stone-700">
              {entries[key].content || 'Empty page'}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
