import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import Modal from '../components/Modal'
import { InkMark } from '../components/Navbar'
import ThemeToggle from '../components/ThemeToggle'
import { isSupabaseConfigured, supabaseUrl, testSupabaseConnection } from '../config/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { mode, loading, isGuest } = useAuth()
  const [connStatus, setConnStatus] = useState({
    checked: false,
    ok: false,
    status: isSupabaseConfigured ? 'checking' : 'unconfigured',
    message: '',
  })
  const [showSetupGuide, setShowSetupGuide] = useState(false)
  const [testing, setTesting] = useState(false)

  async function handleManualTest() {
    setTesting(true)
    const res = await testSupabaseConnection()
    setConnStatus({
      checked: true,
      ok: res.ok,
      status: res.status,
      message: res.message,
    })
    setTesting(false)
  }

  useEffect(() => {
    let active = true
    testSupabaseConnection().then((res) => {
      if (active) {
        setConnStatus({
          checked: true,
          ok: res.ok,
          status: res.status,
          message: res.message,
        })
      }
    })
    return () => {
      active = false
    }
  }, [])

  if (loading) return null
  if (mode === 'server') return <Navigate to="/" replace />

  return (
    <div className="flex min-h-svh flex-col bg-bg text-ink">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-display text-xl tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-on-accent shadow-sm">
            <InkMark className="h-4.5 w-4.5" />
          </span>
          Daily Ink
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSetupGuide(true)}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:bg-surface hover:text-ink transition"
          >
            Supabase Setup Guide
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Connection status banner */}
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  connStatus.ok
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : connStatus.status === 'checking' || testing
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-400'
                }`}
              />
              <span className="truncate text-muted">
                {testing
                  ? 'Testing connection…'
                  : connStatus.ok
                    ? 'Supabase Connected'
                    : connStatus.status === 'unconfigured'
                      ? 'Supabase Not Configured'
                      : 'Supabase Unreachable'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSetupGuide(true)}
              className="shrink-0 text-accent font-medium hover:underline ml-2"
            >
              Configure
            </button>
          </div>

          <p className="mb-3 text-center font-hand text-2xl text-accent">your pages, your memory</p>
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-pop">
            <AuthForm />
          </div>

          {isGuest && (
            <div className="mt-4 text-center">
              <Link
                to="/"
                className="text-xs text-muted hover:text-ink underline-offset-4 hover:underline"
              >
                ← Return to your local journal
              </Link>
            </div>
          )}
        </div>
      </main>

      <footer className="mx-auto max-w-sm px-4 pb-8 text-center text-xs text-faint">
        {!isSupabaseConfigured ? (
          <>
            Running in <strong>local mode</strong> — credentials not configured yet, so pages stay on this device.
          </>
        ) : (
          <>
            Protected by Supabase Auth and row-level security. Entries sync seamlessly across devices.
          </>
        )}
      </footer>

      {/* Supabase Connection Setup Guide Modal */}
      {showSetupGuide && (
        <Modal onClose={() => setShowSetupGuide(false)} title="Connect Supabase">
          <div className="space-y-4 text-sm text-ink">
            <p className="text-muted">
              Daily Ink uses Supabase for user authentication, cloud sync, and real-time multi-device updates.
            </p>

            <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs space-y-1">
              <p className="font-semibold text-ink">Connection Status:</p>
              <p className={connStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                {connStatus.message || (connStatus.ok ? 'Connected' : 'Not reachable')}
              </p>
              {supabaseUrl ? (
                <p className="text-faint truncate">Current URL: {supabaseUrl}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-ink">Quick Setup Steps:</h3>
              <ol className="list-decimal pl-5 space-y-1.5 text-muted text-xs leading-relaxed">
                <li>
                  Create a free project at{' '}
                  <a
                    href="https://supabase.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    supabase.com
                  </a>
                  .
                </li>
                <li>
                  Go to <strong>Project Settings → API</strong> in your Supabase dashboard and copy your <strong>Project URL</strong> and <strong>anon public key</strong>.
                </li>
                <li>
                  Add them to your project's <code className="rounded bg-surface-2 px-1 py-0.5">.env.local</code> file:
                  <pre className="mt-1 rounded-lg bg-surface p-2 font-mono text-[11px] overflow-x-auto text-ink border border-border">
{`SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key`}
                  </pre>
                </li>
                <li>
                  In Supabase, open <strong>SQL Editor → New Query</strong>, copy and paste the contents of <code className="rounded bg-surface-2 px-1 py-0.5">supabase/schema.sql</code>, and click <strong>Run</strong>.
                </li>
              </ol>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={handleManualTest}
                disabled={testing}
                className="rounded-full border border-border px-4 py-1.5 text-xs text-ink hover:bg-surface-2 transition disabled:opacity-50"
              >
                {testing ? 'Testing…' : 'Test Connection Again'}
              </button>
              <button
                type="button"
                onClick={() => setShowSetupGuide(false)}
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-on-accent transition hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}