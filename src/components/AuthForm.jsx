import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none ring-accent/30 placeholder:text-faint focus:ring-4 transition'

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

export default function AuthForm() {
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  function switchMode(next) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)

    try {
      if (mode === 'signin') {
        const { error: signInError } = await signIn(username.trim(), password)
        if (signInError) setError(signInError)
      } else if (mode === 'signup') {
        const { error: signUpError } = await signUp(username.trim(), password)
        if (signUpError) {
          setError(signUpError)
        } else {
          setNotice('Account created! You can now sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err?.message || 'An unexpected error occurred.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center sm:text-left">
        <h1 className="font-display text-2xl text-ink">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'signin'
            ? 'Sign in with your username and password.'
            : "Pick a username — it's how you'll sign in every day."}
        </p>
      </div>

      {notice ? (
        <div role="status" className="mt-4 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger break-words">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="auth-username" className="mb-1 block text-sm font-medium text-muted">
            Username
          </label>
          <input
            id="auth-username"
            type="text"
            autoComplete="username"
            required
            minLength={2}
            placeholder="e.g. maya"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="auth-password" className="text-sm font-medium text-muted">
              Password
            </label>
          </div>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              placeholder="At least 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-faint hover:text-ink transition"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showPassword} className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50 shadow-sm"
        >
          {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {/* Mode navigation links */}
      <div className="mt-5 space-y-2 text-center text-sm text-muted">
        {mode === 'signin' ? (
          <div>
            New here?{' '}
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              Create an account
            </button>
          </div>
        ) : (
          <div>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
