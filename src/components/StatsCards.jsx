function Stat({ value, label }) {
  return (
    <div className="px-4 py-3 first:pl-0">
      <p className="font-display text-2xl leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
    </div>
  )
}

export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-border">
      <Stat value={stats.longest} label="Longest streak" />
      <Stat value={stats.total} label="Entries" />
      <Stat value={stats.dueCount} label="Memories due" />
    </div>
  )
}
