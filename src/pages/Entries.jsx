import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import EntryCard from '../components/EntryCard'
import SearchFilters from '../components/SearchFilters'
import Spinner from '../components/Spinner'
import { useEncryption } from '../hooks/useEncryption'
import { useEntries } from '../hooks/useEntries'
import { formatEntryDate } from '../utils/formatDate'

function matches(entry, tasks, text, filters) {
  if (filters.from && entry.dateKey < filters.from) return false
  if (filters.to && entry.dateKey > filters.to) return false
  if (filters.mood && entry.entry.mood !== filters.mood) return false
  if (filters.hasTasks && tasks.length === 0) return false

  if (filters.q) {
    const q = filters.q.toLowerCase()
    const haystack = `${text} ${tasks.map((t) => t.title).join(' ')} ${formatEntryDate(entry.dateKey)}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }
  return true
}

export default function Entries() {
  const { entries, tasks, loading } = useEntries()
  const { decrypt, enabled } = useEncryption()
  const [filters, setFilters] = useState({ q: '', from: null, to: null, mood: null, hasTasks: false })
  const [texts, setTexts] = useState(null)

  // When encryption is on, decrypt everything once so search works client-side.
  useEffect(() => {
    if (!enabled) {
      setTexts(null)
      return undefined
    }
    let active = true
    Promise.all(
      Object.entries(entries).map(async ([dateKey, entry]) => [
        dateKey,
        await decrypt(entry?.content ?? ''),
      ]),
    ).then((pairs) => {
      if (active) setTexts(Object.fromEntries(pairs))
    })
    return () => {
      active = false
    }
  }, [entries, enabled, decrypt])

  const filtered = useMemo(() => {
    const list = Object.entries(entries).map(([dateKey, entry]) => ({
      dateKey,
      entry,
      tasks: tasks[dateKey] ?? [],
    }))
    return list
      .filter((item) =>
        matches(item, item.tasks, enabled ? texts?.[item.dateKey] ?? '' : item.entry.content ?? '', filters),
      )
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  }, [entries, tasks, texts, enabled, filters])

  if (loading) return <Spinner label="Gathering your pages…" />

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <p className="font-hand text-2xl leading-none text-accent">all your pages</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Past entries</h1>
        <p className="mt-1 text-sm text-muted">
          {Object.keys(entries).length} page{Object.keys(entries).length === 1 ? '' : 's'} written
        </p>
      </header>

      <SearchFilters filters={filters} onChange={setFilters} />

      {filtered.length === 0 ? (
        <EmptyState
          emoji={Object.keys(entries).length === 0 ? '📖' : '🔍'}
          title={Object.keys(entries).length === 0 ? 'No pages yet' : 'Nothing matches'}
        >
          {Object.keys(entries).length === 0 ? (
            <p>
              Start with today’s page — <a className="text-accent underline" href="/journal">write now</a>.
            </p>
          ) : (
            <p>Try a different search or clear the filters.</p>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <li key={item.dateKey}>
              <EntryCard dateKey={item.dateKey} entry={item.entry} tasks={item.tasks} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}