import { Link, Navigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { InkMark } from '../components/Navbar'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'

const HIGHLIGHTS = [
  { emoji: '📖', title: 'One page a day', copy: 'A quiet place to put the day down in words.' },
  { emoji: '🧠', title: 'Memories resurface', copy: 'Old pages come back exactly when they should.' },
  { emoji: '🔒', title: 'Private by default', copy: 'Optional end-to-end encryption, your own database.' },
]

function Brand({ className = '' }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 text-ink ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-on-accent shadow-sm">
        <InkMark className="h-4.5 w-4.5" />
      </span>
      <span className="font-display text-xl tracking-tight">Daily Ink</span>
    </Link>
  )
}

export default function Login() {
  const { mode, loading } = useAuth()

  if (loading) return null
  if (mode === 'server') return <Navigate to="/" replace />

  return (
    <div className="flex min-h-svh flex-col bg-bg text-ink lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="paper-wash relative hidden flex-col justify-between border-r border-border p-10 lg:flex xl:p-14">
        <Brand />

        <div className="max-w-md">
          <p className="font-hand text-3xl leading-tight text-accent">your pages, your memory</p>
          <h2 className="mt-3 font-display text-4xl leading-[1.1] tracking-tight text-ink xl:text-5xl">
            Write a little every day. Remember it for years.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Daily Ink keeps a single page per day, then brings the best of them back when they
            matter. No feeds, no noise, no audience.
          </p>

          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-surface text-base shadow-card"
                >
                  {item.emoji}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{item.copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-faint">
          Private, encrypted &amp; synced - your personal daily journal.
        </p>
      </aside>

      {/* Form side */}
      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-5 py-5 lg:justify-end">
          <Brand className="lg:hidden" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <div className="w-full max-w-sm">
            <p className="mb-4 text-center font-hand text-2xl text-accent lg:hidden">
              your pages, your memory
            </p>
            <div className="rounded-3xl border border-border bg-surface p-6 shadow-pop sm:p-7">
              <AuthForm />
            </div>
            <p className="mt-5 text-center text-xs leading-relaxed text-faint">
              Private, encrypted &amp; synced - your personal daily journal.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
