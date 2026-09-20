import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { useEncryption } from '../hooks/useEncryption'
import { useEntries } from '../hooks/useEntries'
import { useLock } from '../hooks/useLock'
import { useReviews } from '../hooks/useReviews'
import { buildJSONExport, buildMarkdownExport, downloadText } from '../utils/exportData'

const inputClass =
  'w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none ring-accent/30 placeholder:text-faint focus:ring-4'

function Section({ title, children, description }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
        <h2 className="font-display text-lg text-ink">{title}</h2>
      </div>
      {description ? <p className="mt-1 pl-3.5 text-sm text-muted">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">{label}</div>
      {children}
    </div>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const { theme, setMode } = useTheme()
  const { toast } = useToast()
  const { entries, tasks } = useEntries()
  const { reviews } = useReviews()

  const encryption = useEncryption()
  const lock = useLock()

  const [passphrase, setPassphrase] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [encBusy, setEncBusy] = useState(false)

  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [lockBusy, setLockBusy] = useState(false)

  async function handleEnableEncryption(event) {
    event.preventDefault()
    if (passphrase.length < 8) {
      toast('Use at least 8 characters', 'error')
      return
    }
    if (passphrase !== confirmPass) {
      toast('Passphrases do not match', 'error')
      return
    }
    setEncBusy(true)
    try {
      await encryption.enable(passphrase)
      setPassphrase('')
      setConfirmPass('')
      toast('Encryption enabled — new entries are encrypted before upload', 'success')
    } catch (err) {
      toast(err?.message ?? 'Could not enable encryption', 'error')
    } finally {
      setEncBusy(false)
    }
  }

  async function handleUnlockEncryption(event) {
    event.preventDefault()
    setEncBusy(true)
    let ok = false
    try {
      ok = await encryption.unlock(passphrase)
    } catch {
      ok = false
    }
    setEncBusy(false)
    if (ok) {
      setPassphrase('')
      toast('Encryption unlocked for this session', 'success')
    } else {
      toast('Wrong passphrase', 'error')
    }
  }

  async function handleEnableLock(event) {
    event.preventDefault()
    if (pin.length < 4) {
      toast('PIN needs at least 4 digits', 'error')
      return
    }
    if (pin !== pinConfirm) {
      toast('PINs do not match', 'error')
      return
    }
    setLockBusy(true)
    await lock.enable(pin)
    setLockBusy(false)
    setPin('')
    setPinConfirm('')
    toast('Lock enabled', 'success')
  }

  async function handleRegisterBiometric() {
    try {
      await lock.registerBiometric()
      toast('Biometric unlock ready', 'success')
    } catch (err) {
      toast(err?.message ?? 'Biometric setup failed', 'error')
    }
  }

  async function handleExport(format) {
    try {
      if (format === 'json') {
        downloadText(
          `daily-ink-export-${new Date().toISOString().slice(0, 10)}.json`,
          JSON.stringify(buildJSONExport(entries, tasks, reviews), null, 2),
          'application/json',
        )
      } else {
        downloadText(
          `daily-ink-export-${new Date().toISOString().slice(0, 10)}.md`,
          buildMarkdownExport(entries, tasks),
          'text/markdown',
        )
      }
      toast('Export downloaded', 'success')
    } catch {
      toast('Export failed', 'error')
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <p className="font-hand text-2xl leading-none text-accent">make it yours</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Settings</h1>
      </header>

      <Section title="Account & Sync">
        <Row
          label={
            <div>
              <p className="text-sm font-medium text-ink">
                {user ? (
                  <>
                    {user.user_metadata?.display_name
                      ? `${user.user_metadata.display_name} (${user.email})`
                      : user.email}
                  </>
                ) : (
                  'Local Mode (Offline)'
                )}
              </p>
              <p className="text-xs text-faint">
                {user
                  ? 'Your journal entries sync securely in real time across your devices.'
                  : 'Pages are stored locally in this browser. Sign in to sync across devices.'}
              </p>
            </div>
          }
        >
          {user ? (
            <button
              type="button"
              onClick={signOut}
              className="rounded-full border border-border px-4 py-1.5 text-xs sm:text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-accent px-4 py-1.5 text-xs sm:text-sm font-medium text-on-accent transition hover:opacity-90 shadow-sm"
            >
              Sign in / Connect
            </Link>
          )}
        </Row>
      </Section>

      <Section title="Appearance">
        <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
          {[
            ['light', 'Light'],
            ['dark', 'Dark'],
            ['system', 'System'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setMode(value)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                theme === value
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Encryption"
        description="Optional client-side encryption: entries are encrypted with AES-256 before they ever leave this device. The passphrase is never stored — if you forget it, encrypted entries are unrecoverable."
      >
        {!encryption.enabled ? (
          <form onSubmit={handleEnableEncryption} className="space-y-3">
            <div>
              <label htmlFor="enc-pass" className="mb-1 block text-sm text-muted">
                Passphrase (min 8 characters)
              </label>
              <input
                id="enc-pass"
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                className={inputClass}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="enc-confirm" className="mb-1 block text-sm text-muted">
                Confirm passphrase
              </label>
              <input
                id="enc-confirm"
                type="password"
                value={confirmPass}
                onChange={(event) => setConfirmPass(event.target.value)}
                className={inputClass}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={encBusy}
              className="rounded-full bg-accent px-5 py-2 text-sm text-on-accent transition hover:opacity-90 disabled:opacity-50"
            >
              Enable encryption
            </button>
          </form>
        ) : encryption.unlocked ? (
          <div className="space-y-3">
            <p className="text-sm text-success">🔒 Encryption is on and unlocked this session.</p>
            <Row
              label={
                <div>
                  <p className="text-sm text-ink">Lock this session</p>
                  <p className="text-xs text-faint">You’ll need the passphrase to decrypt again.</p>
                </div>
              }
            >
              <button
                type="button"
                onClick={encryption.lock}
                className="rounded-full border border-border px-4 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                Lock now
              </button>
            </Row>
            <Row
              label={
                <div>
                  <p className="text-sm text-ink">Turn off encryption</p>
                  <p className="text-xs text-faint">
                    Existing encrypted entries stay encrypted; new entries will be plaintext.
                  </p>
                </div>
              }
            >
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Disable encryption? Existing encrypted entries remain encrypted.')) {
                    encryption.disable()
                    toast('Encryption disabled', 'success')
                  }
                }}
                className="rounded-full border border-danger/40 px-4 py-2 text-sm text-danger transition hover:bg-danger/10"
              >
                Disable
              </button>
            </Row>
          </div>
        ) : (
          <form onSubmit={handleUnlockEncryption} className="space-y-3">
            <p className="text-sm text-muted">
              🔒 Encryption is on. Enter your passphrase to unlock it for this session.
            </p>
            <div>
              <label htmlFor="enc-unlock" className="mb-1 block text-sm text-muted">
                Passphrase
              </label>
              <input
                id="enc-unlock"
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                className={inputClass}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={encBusy}
              className="rounded-full bg-accent px-5 py-2 text-sm text-on-accent transition hover:opacity-90 disabled:opacity-50"
            >
              Unlock
            </button>
          </form>
        )}
      </Section>

      <Section
        title="App lock"
        description="Lock the app on this device. A PIN is always available; biometrics (face or fingerprint) can be added when supported."
      >
        {!lock.configured ? (
          <form onSubmit={handleEnableLock} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="lock-pin-new" className="mb-1 block text-sm text-muted">
                  PIN
                </label>
                <input
                  id="lock-pin-new"
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="lock-pin-confirm" className="mb-1 block text-sm text-muted">
                  Confirm PIN
                </label>
                <input
                  id="lock-pin-confirm"
                  type="password"
                  inputMode="numeric"
                  value={pinConfirm}
                  onChange={(event) => setPinConfirm(event.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={lockBusy}
              className="rounded-full bg-accent px-5 py-2 text-sm text-on-accent transition hover:opacity-90 disabled:opacity-50"
            >
              Enable lock
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-success">🔒 Lock is enabled.</p>
            <Row
              label={
                <div>
                  <p className="text-sm text-ink">Lock the app now</p>
                  <p className="text-xs text-faint">Reopens only with your PIN or biometrics.</p>
                </div>
              }
            >
              <button
                type="button"
                onClick={lock.lock}
                className="rounded-full border border-border px-4 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                Lock now
              </button>
            </Row>
            {lock.biometricSupported ? (
              <Row
                label={
                  <div>
                    <p className="text-sm text-ink">Biometric unlock</p>
                    <p className="text-xs text-faint">
                      {lock.hasBiometric
                        ? 'Fingerprint / face unlock is set up.'
                        : 'Use your device’s fingerprint or face to unlock.'}
                    </p>
                  </div>
                }
              >
                <button
                  type="button"
                  onClick={handleRegisterBiometric}
                  className="rounded-full border border-border px-4 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
                >
                  {lock.hasBiometric ? 'Re-register' : 'Set up'}
                </button>
              </Row>
            ) : (
              <p className="text-xs text-faint">
                Biometrics aren’t supported here (needs a secure context).
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Disable the app lock?')) {
                  lock.disable()
                  toast('Lock disabled', 'success')
                }
              }}
              className="rounded-full border border-danger/40 px-4 py-2 text-sm text-danger transition hover:bg-danger/10"
            >
              Disable lock
            </button>
          </div>
        )}
      </Section>

      <Section
        title="Your data"
        description="Everything you write is yours. Export it any time — JSON for archives, Markdown for reading."
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="rounded-full bg-accent px-5 py-2 text-sm text-on-accent transition hover:opacity-90"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => handleExport('markdown')}
            className="rounded-full border border-border px-5 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            Export Markdown
          </button>
        </div>
      </Section>

      <p className="text-center text-xs text-faint">
        Daily Ink · entries sync via Supabase with row-level security · optional AES-256
        client-side encryption
      </p>
    </div>
  )
}