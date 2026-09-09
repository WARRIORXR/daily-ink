import { NavLink } from 'react-router-dom'

const linkClass = ({ isActive }) =>
  `rounded-full px-3 py-1.5 text-sm transition ${
    isActive
      ? 'bg-stone-900 text-amber-50'
      : 'text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
  }`

export default function Navbar() {
  return (
    <header className="border-b border-stone-200/80 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <NavLink to="/" className="font-display text-xl tracking-tight text-stone-900">
          Daily Ink
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/" className={linkClass} end>
            Today
          </NavLink>
          <NavLink to="/journal" className={linkClass}>
            Write
          </NavLink>
          <NavLink to="/entries" className={linkClass}>
            Entries
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
