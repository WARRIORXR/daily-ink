import { Outlet } from 'react-router-dom'
import { useDailyReminder } from '../hooks/useDailyReminder'
import { useEncryptedSample } from '../hooks/useEncryptedSample'
import { useEncryption } from '../hooks/useEncryption'
import { useLock } from '../hooks/useLock'
import LockScreen from './LockScreen'
import Navbar from './Navbar'
import PassphraseLock from './PassphraseLock'

export default function Layout() {
  const { locked } = useLock()
  const { enabled, unlocked } = useEncryption()
  const sample = useEncryptedSample(enabled)
  // The passphrase screen replaces the page entirely, so nothing encrypted is
  // shown blank and nothing is saved unencrypted while the key is missing.
  const needsPassphrase = enabled ? !unlocked : Boolean(sample)
  useDailyReminder()

  if (needsPassphrase) return <PassphraseLock sample={sample} />

  return (
    <div className="flex min-h-svh flex-col bg-bg text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:py-12 lg:py-14">
        <Outlet />
      </main>
      <footer className="mt-auto border-t border-border/60 pb-10 pt-6 text-center">
        <p className="font-hand text-xl text-faint" aria-hidden="true">
          one page a day
        </p>
      </footer>
      {locked ? <LockScreen /> : null}
    </div>
  )
}
