import { Link, Navigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { InkMark } from '../components/Navbar'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { mode, loading } = useAuth()

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
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <p className="mb-4 text-center font-hand text-2xl text-accent">your pages, your memory</p>
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-pop">
            <AuthForm />
          </div>
        </div>
      </main>
      <p className="mx-auto max-w-sm px-4 pb-8 text-center text-xs text-faint">
        {mode === 'local' ? (
          <>
            Running in <strong>local mode</strong> — no Supabase credentials configured, so your
            pages stay on this device.
          </>
        ) : (
          <>
            Protected by Supabase Auth and row-level security. No one else can read your pages.
          </>
        )}
      </p>
    </div>
  )
}