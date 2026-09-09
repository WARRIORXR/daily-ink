function Stat({ emoji, tint, value, label, hint }) {
  return (
    <div className="group rounded-2xl border border-border bg-surface p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-pop">
      <div
        aria-hidden="true"
        className={`grid h-10 w-10 place-items-center rounded-xl text-xl ${tint} transition group-hover:scale-110`}
      >
        {emoji}
      </div>
      <p className="mt-3 font-display text-3xl leading-none text-ink">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-faint">{hint}</p> : null}
    </div>
  )
}

export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        emoji="🔥"
        tint="bg-accent-soft"
        value={stats.current}
        label="Current streak"
        hint="consecutive days"
      />
      <Stat
        emoji="🏆"
        tint="bg-clay-soft"
        value={stats.longest}
        label="Longest streak"
        hint="best run"
      />
      <Stat
        emoji="📖"
        tint="bg-surface-2"
        value={stats.total}
        label="Entries"
        hint="pages written"
      />
      <Stat
        emoji="🧠"
        tint="bg-accent-soft"
        value={stats.dueCount}
        label="Memories due"
        hint="ready to review"
      />
    </div>
  )
}