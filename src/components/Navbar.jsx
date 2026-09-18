import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

const LINKS = [
  { to: '/', label: 'Today', end: true },
  { to: '/journal', label: 'Journal' },
  { to: '/entries', label: 'Entries' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/review', label: 'Review' },
  { to: '/settings', label: 'Settings' },
]

const linkClass = ({ isActive }) =>
  `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition ${
    isActive
      ? 'bg-ink text-bg shadow-sm'
      : 'text-muted hover:bg-surface-2 hover:text-ink'
  }`

export function InkMark({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 2.5c4.4 4.9 7 8.8 7 12.3A7 7 0 0 1 5 14.8C5 11.3 7.6 7.4 12 2.5Z"
        fill="currentColor"
      />
      <path
        d="M9.8 14.2a2.9 2.9 0 0 0 2.2 3.6"
        stroke="var(--bg)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Navbar() {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-ink"
            aria-label="Daily Ink home"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-on-accent shadow-sm">
              <InkMark className="h-4.5 w-4.5" />
            </span>
            <span className="font-display text-lg tracking-tight sm:text-xl">Daily Ink</span>
          </Link>

          <nav aria-label="Main" className="flex min-w-0 items-center gap-2">
            <div className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1">
              {LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                  {link.label}
                </NavLink>
              ))}
            </div>
            <div className="ml-1 flex shrink-0 items-center gap-1.5">
              <ThemeToggle />
              {user ? (
                <Link
                  to="/settings"
                  aria-label={`Signed in as ${user.email}`}
                  title={user.email}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-sm font-medium text-accent"
                >
                  {(user.email?.[0] ?? '?').toUpperCase()}
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="whitespace-nowrap rounded-full bg-accent px-3.5 py-1.5 text-xs sm:text-sm font-medium text-on-accent transition hover:opacity-90 shadow-sm"
                >
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}