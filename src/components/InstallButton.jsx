import { useSyncExternalStore } from 'react'
import { canPromptInstall, promptInstall, subscribeInstall } from '../utils/install'

/** Shows only when the browser offers installation (Chrome, Edge, Android). */
export default function InstallButton({ className = '' }) {
  const available = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false)
  if (!available) return null
  return (
    <button
      type="button"
      onClick={promptInstall}
      className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/40 bg-accent-soft px-3 text-sm font-medium text-accent transition hover:border-accent ${className}`}
    >
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
      </svg>
      Install app
    </button>
  )
}
