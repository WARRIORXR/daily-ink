// Loading placeholder: quiet skeleton lines instead of a spinning wheel, so a
// page shows its shape at once while data arrives.
export default function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="w-full max-w-2xl space-y-3 py-8">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="h-6 w-1/3 animate-pulse rounded-full bg-surface-2" />
      <div aria-hidden="true" className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      <div aria-hidden="true" className="h-24 animate-pulse rounded-2xl bg-surface-2/70" />
    </div>
  )
}
