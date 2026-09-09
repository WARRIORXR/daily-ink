export default function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center gap-3 py-12 text-muted">
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent"
      />
      <span className="text-sm">{label}</span>
    </div>
  )
}