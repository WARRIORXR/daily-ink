import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import EntryCard from '../components/EntryCard'
import PageHeader from '../components/PageHeader'
import SearchFilters from '../components/SearchFilters'
import Spinner from '../components/Spinner'
import { useEncryption } from '../hooks/useEncryption'
import { useEntries } from '../hooks/useEntries'
import { formatEntryDate } from '../utils/formatDate'
import { countTags, extractTags, matchesQuery } from '../utils/tags'

const NO_FILTERS = { q: '', from: null, to: null, mood: null, hasTasks: false, tag: null }

function matches(entry, tasks, text, tags, filters) {
  if (filters.from && entry.dateKey < filters.from) return false
  if (filters.to && entry.dateKey > filters.to) return false
  if (filters.mood && entry.entry.mood !== filters.mood) return false
  if (filters.hasTasks && tasks.length === 0) return false
  if (filters.tag && !tags.includes(filters.tag)) return false

  if (filters.q) {
    const haystack = `${text} ${tasks.map((t) => t.title).join(' ')} ${formatEntryDate(entry.dateKey)}`
    if (!matchesQuery(haystack, filters.q)) return false
  }
  return true
}

export default function Entries() {
  const { entries, tasks, loading } = useEntries()
  const { decrypt, enabled } = useEncryption()
  const [searchParams, setSearchParams] = useSearchParams()
  const [baseFilters, setBaseFilters] = useState(NO_FILTERS)
  // The tag lives in the URL so a tag can be linked to and survives Back.
  const filters = { ...baseFilters, tag: searchParams.get('tag') || null }
  const setFilters = (next) => {
    const { tag, ...rest } = next
    setBaseFilters({ ...rest, tag: null })
    if (tag !== filters.tag) setSearchParams(tag ? { tag } : {}, { replace: true })
  }
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

  const list = useMemo(
    () =>
      Object.entries(entries).map(([dateKey, entry]) => {
        const text = enabled ? (texts?.[dateKey] ?? '') : (entry.content ?? '')
        return { dateKey, entry, text, tags: extractTags(text), tasks: tasks[dateKey] ?? [] }
      }),
    [entries, tasks, texts, enabled],
  )
  const allTags = useMemo(() => countTags(list.map((item) => item.tags)), [list])

  const { q, from, to, mood, hasTasks, tag } = filters
  const filtered = useMemo(
    () =>
      list
        .filter((item) =>
          matches(item, item.tasks, item.text, item.tags, { q, from, to, mood, hasTasks, tag }),
        )
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [list, q, from, to, mood, hasTasks, tag],
  )

  if (loading) return <Spinner label="Gathering your pages…" />

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="all your pages"
        title="Past entries"
        description={`${Object.keys(entries).length} page${
          Object.keys(entries).length === 1 ? '' : 's'
        } written - search, filter, and reread any of them.`}
      />

      <SearchFilters filters={filters} tags={allTags} onChange={setFilters} />

      {filtered.length === 0 ? (
        <EmptyState
          emoji={Object.keys(entries).length === 0 ? '📖' : '🔍'}
          title={Object.keys(entries).length === 0 ? 'No pages yet' : 'Nothing matches'}
        >
          {Object.keys(entries).length === 0 ? (
            <p>
              Start with today’s page —{' '}
              <a className="text-accent underline" href="/journal">
                write now
              </a>
              .
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
