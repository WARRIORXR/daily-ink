import { useCallback, useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import { supabase } from '../config/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatTimestamp } from '../utils/formatDate'

const EVENT_LABELS = {
  sign_in: 'Sign in',
  sign_up: 'Sign up',
  sign_out: 'Sign out',
}

const FILTERS = [
  { id: 'all', label: 'All attempts' },
  { id: 'success', label: 'Succeeded' },
  { id: 'failed', label: 'Failed' },
]

/** Turn a raw user-agent string into something a human can scan. */
function describeDevice(userAgent) {
  if (!userAgent) return 'Unknown device'
  const ua = userAgent

  let browser = 'Browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera'
  else if (/Chrome\//.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua)) browser = 'Safari'
  else if (/node|curl|python/i.test(ua)) browser = 'Script'

  let os = ''
  if (/Android/.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'
  else if (/Windows/.test(ua)) os = 'Windows'
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS'
  else if (/CrOS/.test(ua)) os = 'ChromeOS'
  else if (/Linux/.test(ua)) os = 'Linux'

  return os ? `${browser} on ${os}` : browser
}

function Stat({ label, value, tone = 'text-ink' }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <p className={`font-display text-3xl leading-none ${tone}`}>{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  )
}

function ResultBadge({ success, event }) {
  if (event === 'sign_out') {
    return (
      <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted">
        Signed out
      </span>
    )
  }
  return success ? (
    <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      Success
    </span>
  ) : (
    <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
      Failed
    </span>
  )
}

export default function Admin() {
  const { toast } = useToast()
  const { username } = useAuth()

  const [events, setEvents] = useState([])
  // 'loading' | 'ready' | 'unavailable' | 'error'
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('login_events')
      .select('id, username, user_id, event, success, reason, user_agent, created_at')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      // 42P01 = table does not exist; PGRST205 = not in the schema cache.
      // Either way the schema has not been run yet.
      if (error.code === '42P01' || error.code === 'PGRST205') {
        setStatus('unavailable')
      } else {
        setLoadError(error.message)
        setStatus('error')
      }
      return
    }

    setEvents(data ?? [])
    setStatus('ready')
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const failures = events.filter((e) => e.event !== 'sign_out' && !e.success).length
    const successes = events.filter((e) => e.event !== 'sign_out' && e.success).length
    const people = new Set(events.map((e) => e.username?.toLowerCase()).filter(Boolean))
    return {
      total: events.length,
      successes,
      failures,
      people: people.size,
      last: events[0]?.created_at ?? null,
    }
  }, [events])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return events.filter((event) => {
      if (filter === 'success' && !(event.event !== 'sign_out' && event.success)) return false
      if (filter === 'failed' && !(event.event !== 'sign_out' && !event.success)) return false
      if (term && !event.username?.toLowerCase().includes(term)) return false
      return true
    })
  }, [events, filter, search])

  async function handleClear() {
    if (!supabase) return
    if (!window.confirm('Delete every login activity record? This cannot be undone.')) return
    setClearing(true)
    const { error } = await supabase
      .from('login_events')
      .delete()
      .lte('created_at', new Date().toISOString())
    setClearing(false)
    if (error) {
      toast(error.message, 'error')
      return
    }
    setEvents([])
    toast('Login activity cleared', 'success')
  }

  if (!supabase) {
    return (
      <EmptyState emoji="🔐" title="No project connected">
        Admin activity lives in your Supabase project. Add your credentials to .env.local first.
      </EmptyState>
    )
  }

  if (status === 'loading') return <Spinner label="Loading login activity..." />

  if (status === 'unavailable') {
    return (
      <div className="animate-fade-up space-y-6">
        <PageHeader eyebrow="admin" title="Login activity" />
        <EmptyState emoji="🗄️" title="Login log table not found">
          Run the latest supabase/schema.sql in your Supabase SQL editor to create the
          login_events table. Then sign out and back in so the first attempt is recorded.
        </EmptyState>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="animate-fade-up space-y-6">
        <PageHeader eyebrow="admin" title="Login activity" />
        <div
          role="alert"
          className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          Could not read the login log: {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="admin"
        title="Login activity"
        description={
          <>
            Signed in as <span className="text-ink">{username}</span>. Every sign-in, sign-up and
            sign-out attempt lands here - usernames and times only, never passwords.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="rounded-full border border-border bg-surface px-4 py-1.5 text-xs text-muted transition hover:bg-surface-2 hover:text-ink sm:text-sm"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing || events.length === 0}
              className="rounded-full border border-danger/40 bg-surface px-4 py-1.5 text-xs text-danger transition hover:bg-danger/10 disabled:opacity-40 sm:text-sm"
            >
              {clearing ? 'Clearing...' : 'Clear log'}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Attempts" value={stats.total} />
        <Stat label="Succeeded" value={stats.successes} tone="text-success" />
        <Stat label="Failed" value={stats.failures} tone="text-danger" />
        <Stat label="Accounts" value={stats.people} />
      </div>

      <section className="rounded-2xl border border-border bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={filter === option.id}
                className={`rounded-full px-3 py-1 text-xs transition sm:text-sm ${
                  filter === option.id
                    ? 'bg-ink text-bg'
                    : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by username"
            aria-label="Filter by username"
            className="w-full rounded-xl border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none ring-accent/30 placeholder:text-faint focus:ring-4 sm:w-56"
          />
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">
            {events.length === 0
              ? 'No login activity recorded yet. It appears as soon as someone signs in.'
              : 'No attempts match this filter.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {event.username || '(blank)'}
                    </span>
                    <span className="text-xs text-faint">
                      {EVENT_LABELS[event.event] ?? event.event}
                    </span>
                    <ResultBadge success={event.success} event={event.event} />
                  </div>
                  {event.reason && !event.success ? (
                    <p className="break-words text-xs text-muted">{event.reason}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="whitespace-nowrap text-xs text-muted">
                    {formatTimestamp(event.created_at)}
                  </p>
                  <p className="text-xs text-faint">{describeDevice(event.user_agent)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-faint">
        Showing the {events.length} most recent attempt{events.length === 1 ? '' : 's'}
        {stats.last ? ` · latest ${formatTimestamp(stats.last)}` : ''} · times are local to this
        device
      </p>
    </div>
  )
}
