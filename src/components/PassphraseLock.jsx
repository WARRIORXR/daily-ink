import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useEncryption } from '../hooks/useEncryption'
import { releasePinLock } from '../hooks/useLock'

/** Full-screen lock shown while the journal is encrypted and the key isn't in memory. */
export default function PassphraseLock({ sample }) {
  const { unlock } = useEncryption()
  const { signOut, user } = useAuth()
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    let ok = false
    try {
      ok = await unlock(passphrase, sample)
    } catch {
      ok = false
    }
    setBusy(false)
    if (ok) {
      releasePinLock()
      return
    }
    setError('That passphrase did not work. Check it and try again.')
    setPassphrase('')
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-bg p-6">
      <div className="w-full max-w-sm text-center">
        <div
          aria-hidden="true"
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-3xl"
        >
          🔐
        </div>
        <h1 className="mt-4 font-display text-2xl text-ink">Your journal is encrypted</h1>
        <p className="mt-1 text-sm text-muted">
          {sample
            ? 'Enter the passphrase you set on your other device to read and write here.'
            : 'Enter your passphrase to open it.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
          <label htmlFor="unlock-passphrase" className="block text-sm text-muted">
            Passphrase
          </label>
          <input
            id="unlock-passphrase"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'unlock-error' : undefined}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink outline-none ring-accent/30 focus:ring-4"
          />
          {error ? (
            <p id="unlock-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || !passphrase}
            className="min-h-11 w-full rounded-full bg-accent px-5 py-2.5 text-sm text-on-accent transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>

        <p className="mt-6 text-xs text-faint">
          The passphrase is never stored or sent anywhere. If it is lost, encrypted entries cannot
          be recovered.
        </p>
        {user ? (
          <button
            type="button"
            onClick={signOut}
            className="mt-3 min-h-11 text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Sign out
          </button>
        ) : null}
      </div>
    </div>
  )
}
