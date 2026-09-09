import { MOODS } from '../utils/moods'

export default function MoodPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="How was your day?" className="flex flex-wrap gap-2">
      {MOODS.map((mood) => {
        const selected = value === mood.key
        return (
          <button
            key={mood.key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={mood.label}
            onClick={() => onChange(selected ? null : mood.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition duration-150 ${
              selected
                ? 'border-accent bg-accent-soft text-accent shadow-sm'
                : 'border-border bg-surface text-muted hover:-translate-y-0.5 hover:border-faint hover:text-ink'
            }`}
          >
            <span aria-hidden="true" className={selected ? 'scale-110 transition' : 'transition'}>
              {mood.emoji}
            </span>
            <span className="hidden sm:inline">{mood.label}</span>
          </button>
        )
      })}
    </div>
  )
}