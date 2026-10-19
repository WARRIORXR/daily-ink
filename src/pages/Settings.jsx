import { useState } from 'react'
import { Link } from 'react-router-dom'
import InstallButton from '../components/InstallButton'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { openWithCurrentKey, sealWithCurrentKey, useEncryption } from '../hooks/useEncryption'
import { useEntries } from '../hooks/useEntries'
import { useLock } from '../hooks/useLock'
import { useReviews } from '../hooks/useReviews'
import {
  buildJSONExport,
  buildMarkdownExport,
  downloadText,
} from '../utils/exportData'
import { recordExport } from '../utils/backupReminder'
import { getEntryKey } from '../utils/formatDate'
import { parseImport } from '../utils/importData'
import { isIOS, isStandalone } from '../utils/install'

const inputClass =
  'w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none ring-accent/30 placeholder:text-faint focus:ring-4'

function Section({ title, children, description }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-accent"
        />
        <h2 className="font-display text-lg text-ink">{title}</h2>
      </div>
      {description && (
        <p className="mt-1 pl-3.5 text-sm text-muted">{description}</p>
      )}
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
  const { user, username, signOut } = useAuth()
  const { theme, setMode } = useTheme()
  const { toast } = useToast()
  const { entries, tasks, importData, saveEntry, mode: storageMode } = useEntries()
  const [pendingImport, setPendingImport] = useState(null)
  const [importing, setImporting] = useState(false)
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
      const count = await resealEntries(true)
      toast(
        count
          ? `Encryption on. ${count} existing ${count === 1 ? 'entry' : 'entries'} encrypted.`
          : 'Encryption on. New entries are encrypted.',
        'success',
      )
    } catch (err) {
      toast(err?.message ?? 'Could not enable encryption', 'error')
    } finally {
      setEncBusy(false)
    }
  }

  // Re-save every entry encrypted (on) or as plain text (off). Runs one entry
  // at a time so a failure part-way leaves each entry readable either way.
  async function resealEntries(toEncrypted) {
    let count = 0
    for (const [date, entry] of Object.entries(entries)) {
      if (Boolean(entry.encrypted) === toEncrypted || !entry.content) continue
      if (toEncrypted) {
        const sealed = await sealWithCurrentKey(entry.content)
        await saveEntry(date, { content: sealed.content, encrypted: true })
      } else {
        const plain = await openWithCurrentKey(entry.content)
        await saveEntry(date, { content: plain, encrypted: false })
      }
      count++
    }
    return count
  }

  async function handleDisableEncryption() {
    if (
      !window.confirm(
        'Turn off encryption? Your entries will be decrypted on this device and saved as plain text.',
      )
    ) {
      return
    }
    setEncBusy(true)
    try {
      const count = await resealEntries(false)
      encryption.disable()
      toast(
        `Encryption off. ${count} ${count === 1 ? 'entry' : 'entries'} saved as plain text.`,
        'success',
      )
    } catch (err) {
      toast(err?.message ?? 'Could not turn off encryption', 'error')
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
          `daily-ink-export-${getEntryKey()}.json`,
          JSON.stringify(
            buildJSONExport(entries, tasks, reviews),
            null,
            2,
          ),
          'application/json',
        )
      } else {
        downloadText(
          `daily-ink-export-${getEntryKey()}.md`,
          buildMarkdownExport(entries, tasks),
          'text/markdown',
        )
      }
      recordExport()
      toast('Export downloaded', 'success')
    } catch {
      toast('Export failed', 'error')
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = parseImport(await file.text())
      if (!Object.keys(parsed.entries).length) {
        toast('No entries found in that file', 'error')
        return
      }
      setPendingImport({ name: file.name, ...parsed })
    } catch (err) {
      toast(err?.message ?? 'Could not read that file', 'error')
    }
  }

  async function handleImport(strategy) {
    if (
      strategy === 'replace' &&
      !window.confirm(
        'Replace your whole journal with this file? Entries and tasks not in the file will be deleted. Export a backup first if unsure.',
      )
    ) {
      return
    }
    setImporting(true)
    let data = pendingImport
    if (encryption.enabled) {
      // Keep the journal fully encrypted: seal plain-text entries from the file first.
      const sealedEntries = {}
      for (const [date, entry] of Object.entries(data.entries)) {
        sealedEntries[date] =
          entry.encrypted || !entry.content
            ? entry
            : { ...entry, ...(await sealWithCurrentKey(entry.content)) }
      }
      data = { ...data, entries: sealedEntries }
    }
    const ok = await importData(data, strategy)
    setImporting(false)
    if (!ok) return
    setPendingImport(null)
    toast(strategy === 'replace' ? 'Journal replaced from file' : 'Entries merged in', 'success')
  }

  const importCount = pendingImport ? Object.keys(pendingImport.entries).length : 0
  const importNew = pendingImport
    ? Object.keys(pendingImport.entries).filter((date) => !entries[date]).length
    : 0

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="make it yours"
        title="Settings"
        description="Account, appearance, encryption, app lock and exports."
      />

      {/* Account & Sync */}
      <Section
        title="Account & Sync"
        description="Sign in to sync your journal across devices. Without it, everything stays in this browser."
      >
        <Row
          label={
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-ink">
                {user ? (
                  <>
                    {user.user_metadata?.display_name || username}
                    <span className="ml-2 text-xs font-normal text-faint">@{username}</span>
                  </>
                ) : (
                  'Local Mode (Offline)'
                )}
              </p>
              <p className="text-xs text-faint">
                {user
                  ? 'Entries sync securely across your devices.'
                  : 'Pages are stored locally. Sign in to sync.'}
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

      {/* Appearance */}
      <Section title="Appearance">
        <div
          role="radiogroup"
          aria-label="Theme"
          className="flex flex-wrap gap-2"
        >
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

      {/* Encryption */}
      <Section
        title="Encryption"
        description="Encrypt every entry with a passphrase (AES-256, key derived with PBKDF2) before it leaves this device. Turning it on also asks for the passphrase each time the app opens and after 5 minutes in the background."
      >
        {!encryption.enabled ? (
          <form onSubmit={handleEnableEncryption} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="enc-pass"
                  className="mb-1 block text-sm text-muted"
                >
                  Passphrase
                </label>
                <input
                  id="enc-pass"
                  type="password"
                  value={passphrase}
                  onChange={(event) =>
                    setPassphrase(event.target.value)
                  }
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label
                  htmlFor="enc-confirm"
                  className="mb-1 block text-sm text-muted"
                >
                  Confirm
                </label>
                <input
                  id="enc-confirm"
                  type="password"
                  value={confirmPass}
                  onChange={(event) =>
                    setConfirmPass(event.target.value)
                  }
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <p className="text-xs text-faint">
              At least 8 characters. It is never stored or sent anywhere, so if you lose it your
              encrypted entries cannot be recovered by anyone, including us.
            </p>
            <button
              type="submit"
              disabled={encBusy}
              className="rounded-full bg-accent px-5 py-2 text-sm text-on-accent transition hover:opacity-90 disabled:opacity-50"
            >
              {encBusy ? 'Enabling…' : 'Enable encryption'}
            </button>
          </form>
        ) : encryption.unlocked ? (
          <div className="space-y-3">
            <p className="text-sm text-success">
              🔒 Encryption is on. Entries are encrypted on this device before they are saved or synced.
            </p>
            <Row
              label={
                <div className="space-y-0.5">
                  <p className="text-sm text-ink">Lock this session</p>
                  <p className="text-xs text-faint">
                    You'll need the passphrase to decrypt again.
                  </p>
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
                <div className="space-y-0.5">
                  <p className="text-sm text-ink">Turn off encryption</p>
                  <p className="text-xs text-faint">
                    Decrypts every entry and saves it as plain text.
                  </p>
                </div>
              }
            >
              <button
                type="button"
                disabled={encBusy}
                onClick={handleDisableEncryption}
                className="rounded-full border border-danger/40 px-4 py-2 text-sm text-danger transition hover:bg-danger/10"
              >
                Disable
              </button>
            </Row>
          </div>
        ) : (
          <form onSubmit={handleUnlockEncryption} className="space-y-3">
            <p className="text-sm text-muted">
              🔒 Encryption is on. Enter your passphrase to unlock it.
            </p>
            <div>
              <label
                htmlFor="enc-unlock"
                className="mb-1 block text-sm text-muted"
              >
                Passphrase
              </label>
              <input
                id="enc-unlock"
                type="password"
                value={passphrase}
                onChange={(event) =>
                  setPassphrase(event.target.value)
                }
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

      {/* App lock */}
      <Section
        title="App Lock"
        description="Lock the app on this device. A PIN is always available; biometrics (face or fingerprint) can be added when supported."
      >
        {!lock.configured ? (
          <form onSubmit={handleEnableLock} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="lock-pin-new"
                  className="mb-1 block text-sm text-muted"
                >
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
                <label
                  htmlFor="lock-pin-confirm"
                  className="mb-1 block text-sm text-muted"
                >
                  Confirm PIN
                </label>
                <input
                  id="lock-pin-confirm"
                  type="password"
                  inputMode="numeric"
                  value={pinConfirm}
                  onChange={(event) =>
                    setPinConfirm(event.target.value)
                  }
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <p className="text-xs text-faint">At least 4 digits.</p>
            <button
              type="submit"
              disabled={lockBusy}
              className="rounded-full bg-accent px-5 py-2 text-sm text-on-accent transition hover:opacity-90 disabled:opacity-50"
            >
              {lockBusy ? 'Enabling…' : 'Enable lock'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-success">🔒 Lock is enabled.</p>
            <Row
              label={
                <div className="space-y-0.5">
                  <p className="text-sm text-ink">Lock the app now</p>
                  <p className="text-xs text-faint">
                    Reopens only with your PIN or biometrics.
                  </p>
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
                  <div className="space-y-0.5">
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

      {/* Install */}
      <Section
        title="Install Daily Ink"
        description="Add Daily Ink to your home screen or dock. It opens like an app and works offline once loaded."
      >
        {isStandalone() ? (
          <p className="text-sm text-success">✓ Installed. You're using the app version.</p>
        ) : (
          <div className="space-y-2 text-sm text-muted">
            <InstallButton />
            {isIOS() ? (
              <p>
                On iPhone or iPad: open this page in Safari, tap the Share button, then{' '}
                <span className="font-medium text-ink">Add to Home Screen</span>.
              </p>
            ) : (
              <p>
                No button? Use your browser menu's{' '}
                <span className="font-medium text-ink">Install app</span> or{' '}
                <span className="font-medium text-ink">Add to Home screen</span> option.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Where data lives */}
      <Section title="Where your data is stored">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          {storageMode === 'server' ? (
            <li>
              Entries, tasks and reviews are saved to your Daily Ink account (Supabase) so they
              sync between your devices. Only you can read them: each row is tied to your account.
            </li>
          ) : (
            <li>
              Entries and tasks are saved only in this browser (IndexedDB). Clearing site data
              deletes them, so export a backup regularly.
            </li>
          )}
          <li>
            {encryption.enabled
              ? 'Encryption is on: entry text is encrypted on this device first, so the server only ever stores unreadable text. Moods, dates and tasks are not encrypted.'
              : 'Encryption is off: entry text is stored as plain text. Turn it on above to encrypt it on this device first.'}
          </li>
          <li>
            Your passphrase and app-lock PIN never leave this device. If the passphrase is lost,
            encrypted entries cannot be recovered.
          </li>
          <li>Settings such as theme, word goal and lock live in this browser only.</li>
          <li>No analytics or tracking.</li>
        </ul>
      </Section>

      {/* Data export */}
      <Section
        title="Your Data"
        description="Everything you write is yours. Export it any time (JSON for archives, Markdown for reading) and import a JSON export back."
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
          <label className="cursor-pointer rounded-full border border-border px-5 py-2 text-sm text-muted transition focus-within:ring-2 focus-within:ring-accent hover:bg-surface-2 hover:text-ink">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="sr-only"
            />
          </label>
        </div>

        {pendingImport ? (
          <div className="space-y-3 rounded-xl border border-accent/30 bg-accent-soft p-4 text-sm">
            <p className="text-ink">
              <span className="font-medium">{pendingImport.name}</span>: {importCount}{' '}
              {importCount === 1 ? 'entry' : 'entries'}, {importNew} of them on days you don't
              have yet.
            </p>
            {pendingImport.problems.length ? (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">
                  {pendingImport.problems.length} row
                  {pendingImport.problems.length === 1 ? '' : 's'} skipped
                </summary>
                <ul className="mt-1 list-disc pl-5">
                  {pendingImport.problems.slice(0, 20).map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            <p className="text-xs text-muted">
              Merge keeps everything you have and adds the missing days. Replace makes the file
              your whole journal.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={importing}
                onClick={() => handleImport('merge')}
                className="rounded-full bg-accent px-4 py-2 text-sm text-on-accent transition hover:opacity-90 disabled:opacity-50"
              >
                Merge
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => handleImport('replace')}
                className="rounded-full border border-danger/40 px-4 py-2 text-sm text-danger transition hover:bg-danger/10 disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => setPendingImport(null)}
                className="rounded-full px-4 py-2 text-sm text-muted transition hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      <p className="text-center text-xs text-faint">
        Daily Ink · entries sync via Supabase with row-level security · optional AES-256
        encryption on your device
      </p>
    </div>
  )
}
