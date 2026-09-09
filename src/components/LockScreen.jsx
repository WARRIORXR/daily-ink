import { useState } from 'react'
import { useLock } from '../hooks/useLock'
import { useToast } from '../context/ToastContext'

export default function LockScreen() {
  const { unlockWithPin, unlockWithBiometric, biometricSupported, hasBiometric } = useLock()
  const { toast } = useToast()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    const ok = await unlockWithPin(pin)
    setBusy(false)
    if (!ok) {
      toast('Incorrect PIN', 'error')
      setPin('')
    }
  }

  async function handleBiometric() {
    setBusy(true)
    const ok = await unlockWithBiometric()
    setBusy(false)
    if (!ok) toast('Biometric unlock failed', 'error')
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-xs text-center">
        <div
          aria-hidden="true"
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-3xl"
        >
          🔒
        </div>
        <h1 className="mt-4 font-display text-2xl text-ink">Your journal is locked</h1>
        <p className="mt-1 text-sm text-muted">Enter your PIN to open it.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label htmlFor="lock-pin" className="sr-only">
            PIN
          </label>
          <input
            id="lock-pin"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="••••"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tracking-[0.5em] text-ink outline-none ring-accent/30 focus:ring-4"
          />
          <button
            type="submit"
            disabled={busy || pin.length === 0}
            className="w-full rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition hover:opacity-90 disabled:opacity-50"
          >
            Unlock
          </button>
        </form>

        {biometricSupported && hasBiometric ? (
          <button
            type="button"
            onClick={handleBiometric}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-5.5 0a5.5 5.5 0 1 1 11 0M4 11a8 8 0 0 1 16 0M8 11a4 4 0 0 1 8 0" />
            </svg>
            Use biometrics
          </button>
        ) : null}
      </div>
    </div>
  )
}