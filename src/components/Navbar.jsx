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

// Plain text links; the current page is marked by weight and an underline.
const linkClass = ({ isActive }) =>
  `block whitespace-nowrap py-1 text-sm underline-offset-[6px] transition ${
    isActive ? 'font-medium text-ink underline decoration-1' : 'text-muted hover:text-ink'
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
  const { user, username, isAdmin } = useAuth()
  // Admins get an extra tab; nobody else can reach /admin anyway.
  const links = isAdmin ? [...LINKS, { to: '/admin', label: 'Admin' }] : LINKS

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto w-full max-w-4xl px-4">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 text-ink"
            aria-label="Daily Ink home"
          >
            <InkMark className="h-4 w-4" />
            <span className="font-display text-lg tracking-tight">Daily Ink</span>
          </Link>

          <div className="flex shrink-0 items-center gap-4">
            <nav aria-label="Main" className="hidden md:block">
              <ul className="flex items-center gap-5">
                {links.map((link) => (
                  <li key={link.to}>
                    <NavLink to={link.to} end={link.end} className={linkClass}>
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <ThemeToggle />

            {user ? (
              <Link
                to="/settings"
                aria-label={username ? `Signed in as ${username}` : 'Account settings'}
                title={username ? `Signed in as ${username}` : 'Account settings'}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-xs font-medium text-ink transition hover:bg-surface-2"
              >
                {(username?.[0] ?? '?').toUpperCase()}
              </Link>
            ) : (
              <Link
                to="/login"
                className="whitespace-nowrap text-sm font-medium text-ink underline underline-offset-4"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>

        <nav aria-label="Main" className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2 md:hidden">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
