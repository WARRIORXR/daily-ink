import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none ring-accent/30 placeholder:text-faint transition focus:ring-4'

const MODES = [
  { id: 'signin', label: 'Sign in' },
  { id: 'signup', label: 'Create account' },
]

function EyeIcon({ open = false, className = 'h-4 w-4' }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

function AlertIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" x2="12" y1="8" y2="12.5" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  )
}

function CheckIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  )
}

/** Client-side checks mirroring what Supabase will enforce anyway. */
function validateFields(username, password) {
  const errors = {}
  const name = username.trim()
  if (!name) errors.username = 'Pick a username.'
  else if (name.length < 2) errors.username = 'Use at least 2 characters.'
  else if (name.length > 32) errors.username = 'Keep it under 32 characters.'

  if (!password) errors.password = 'Enter a password.'
  else if (password.length < 6) errors.password = 'Use at least 6 characters.'

  return errors
}

export default function AuthForm() {
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  // Only start showing live validation once the user has tried to submit.
  const [submitted, setSubmitted] = useState(false)

  const isSignup = mode === 'signup'

  function switchMode(next) {
    setMode(next)
    setFieldErrors({})
    setServerError(null)
    setNotice(null)
    setSubmitted(false)
  }

  function revalidate(nextUsername, nextPassword) {
    if (!submitted) return
    setFieldErrors(validateFields(nextUsername, nextPassword))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setServerError(null)
    setNotice(null)
    setSubmitted(true)

    const errors = validateFields(username, password)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      const firstInvalid = errors.username ? 'auth-username' : 'auth-password'
      document.getElementById(firstInvalid)?.focus()
      return
    }

    setBusy(true)
    try {
      if (isSignup) {
        const { error, needsConfirmation } = await signUp(username.trim(), password)
        if (error) {
          setServerError(error)
        } else if (needsConfirmation) {
          setNotice(
            'Account created. Please sign in below.',
          )
          setMode('signin')
          setSubmitted(false)
          setFieldErrors({})
        } else {
          setNotice('Account created. Welcome in.')
        }
      } else {
        const { error } = await signIn(username.trim(), password)
        if (error) setServerError(error)
      }
    } catch (err) {
      setServerError(err?.message || 'An unexpected error occurred.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full">
      {/* Mode switch */}
      <div
        role="tablist"
        aria-label="Sign in or create an account"
        className="relative grid grid-cols-2 rounded-full border border-border bg-surface-2/80 p-1"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-accent shadow-card transition-transform duration-300 ease-out"
          style={{ transform: mode === 'signin' ? 'translateX(0)' : 'translateX(100%)' }}
        />
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            onClick={() => switchMode(item.id)}
            className={`relative z-10 rounded-full px-3 py-2 text-sm font-medium transition ${
              mode === item.id ? 'text-on-accent' : 'text-muted hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 text-center sm:text-left">
        <h1 className="font-display text-2xl tracking-tight text-ink sm:text-[1.7rem]">
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {isSignup
            ? 'Pick a username and a password. No email address needed.'
            : 'Sign in with your username and password.'}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {notice ? (
          <div
            role="status"
            className="flex gap-2.5 rounded-xl border border-success/30 bg-success/10 px-3.5 py-3 text-sm leading-relaxed text-success"
          >
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{notice}</p>
          </div>
        ) : null}

        {serverError ? (
          <div
            role="alert"
            className="flex gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm leading-relaxed break-words text-danger"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{serverError}</p>
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <div>
          <label htmlFor="auth-username" className="mb-1.5 block text-sm font-medium text-muted">
            Username
          </label>
          <input
            id="auth-username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="e.g. maya"
            value={username}
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? 'auth-username-error' : undefined}
            onChange={(event) => {
              setUsername(event.target.value)
              revalidate(event.target.value, password)
            }}
            className={`${inputClass} ${
              fieldErrors.username ? 'border-danger/60 focus:ring-danger/25' : ''
            }`}
          />
          {fieldErrors.username ? (
            <p id="auth-username-error" className="mt-1.5 text-xs text-danger">
              {fieldErrors.username}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-muted">
            Password
          </label>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder="At least 6 characters"
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
              onChange={(event) => {
                setPassword(event.target.value)
                revalidate(username, event.target.value)
              }}
              className={`${inputClass} pr-11 ${
                fieldErrors.password ? 'border-danger/60 focus:ring-danger/25' : ''
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              <EyeIcon open={showPassword} className="h-4 w-4" />
            </button>
          </div>
          {fieldErrors.password ? (
            <p id="auth-password-error" className="mt-1.5 text-xs text-danger">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-on-accent/40 border-t-on-accent"
              />
              Please wait...
            </>
          ) : isSignup ? (
            'Create account'
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-xs leading-relaxed text-faint">
        {isSignup
          ? 'Your username is the only thing you need to remember.'
          : 'Usernames and passwords only - no email required.'}
      </p>
    </div>
  )
}