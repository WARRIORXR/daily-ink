import { MOODS } from '../utils/moods'

const inputClass =
  'rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none ring-accent/30 placeholder:text-faint focus:ring-4'

export default function SearchFilters({ filters, onChange }) {
  const set = (patch) => onChange({ ...filters, ...patch })
  const active = Boolean(filters.q || filters.from || filters.to || filters.mood || filters.hasTasks)

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="relative">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <label htmlFor="entry-search" className="sr-only">
          Search entries
        </label>
        <input
          id="entry-search"
          type="search"
          value={filters.q}
          onChange={(event) => set({ q: event.target.value })}
          placeholder="Search your pages…"
          className={`${inputClass} w-full pl-10`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <label htmlFor="filter-from" className="text-muted">
            From
          </label>
          <input
            id="filter-from"
            type="date"
            value={filters.from ?? ''}
            onChange={(event) => set({ from: event.target.value || null })}
            className={inputClass}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="filter-to" className="text-muted">
            To
          </label>
          <input
            id="filter-to"
            type="date"
            value={filters.to ?? ''}
            onChange={(event) => set({ to: event.target.value || null })}
            className={inputClass}
          />
        </div>
        <label htmlFor="filter-mood" className="sr-only">
          Filter by mood
        </label>
        <select
          id="filter-mood"
          value={filters.mood ?? ''}
          onChange={(event) => set({ mood: event.target.value || null })}
          className={inputClass}
        >
          <option value="">Any mood</option>
          {MOODS.map((mood) => (
            <option key={mood.key} value={mood.key}>
              {mood.emoji} {mood.label}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-muted">
          <input
            type="checkbox"
            checked={Boolean(filters.hasTasks)}
            onChange={(event) => set({ hasTasks: event.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Has tasks
        </label>
        {active && (
          <button
            type="button"
            onClick={() => onChange({ q: '', from: null, to: null, mood: null, hasTasks: false })}
            className="text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}