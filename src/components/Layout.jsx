import { Outlet } from 'react-router-dom'
import { useLock } from '../hooks/useLock'
import LockScreen from './LockScreen'
import Navbar from './Navbar'

export default function Layout() {
  const { locked } = useLock()

  return (
    <div className="flex min-h-svh flex-col bg-bg text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
        <Outlet />
      </main>
      <footer className="pb-10 pt-4 text-center">
        <p className="font-hand text-xl text-faint" aria-hidden="true">
          one page a day
        </p>
      </footer>
      {locked ? <LockScreen /> : null}
    </div>
  )
}