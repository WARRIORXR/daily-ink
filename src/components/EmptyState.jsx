export default function EmptyState({ emoji = '📖', title, children }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-3xl"
      >
        {emoji}
      </div>
      <h2 className="mt-4 font-display text-xl text-ink">{title}</h2>
      {children ? <div className="mt-2 text-sm text-muted">{children}</div> : null}
    </div>
  )
}