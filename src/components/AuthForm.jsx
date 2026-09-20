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

function GoogleIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

export default function AuthForm() {
  const {
    signIn,
    signUp,
    signInWithOtp,
    signInWithOAuth,
    resetPassword,
    updatePassword,
    isRecoveryMode,
    setIsRecoveryMode,
  } = useAuth()

  // modes: 'signin' | 'signup' | 'magiclink' | 'forgot' | 'reset'
  const [internalMode, setInternalMode] = useState('signin')
  const mode = isRecoveryMode ? 'reset' : internalMode
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  function switchMode(next) {
    if (isRecoveryMode) {
      setIsRecoveryMode(false)
    }
    setInternalMode(next)
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
        const { error: signInError } = await signIn(email.trim(), password)
        if (signInError) setError(signInError)
      } else if (mode === 'signup') {
        const { error: signUpError, needsConfirmation } = await signUp(
          email.trim(),
          password,
          displayName.trim(),
        )
        if (signUpError) {
          setError(signUpError)
        } else if (needsConfirmation) {
          setNotice('Verification email sent! Check your inbox to confirm your account.')
          switchMode('signin')
        }
      } else if (mode === 'magiclink') {
        const { error: otpError } = await signInWithOtp(email.trim())
        if (otpError) {
          setError(otpError)
        } else {
          setNotice('Magic link sent! Check your inbox to sign in with one click.')
        }
      } else if (mode === 'forgot') {
        const { error: resetError } = await resetPassword(email.trim())
        if (resetError) {
          setError(resetError)
        } else {
          setNotice('Password reset email sent! Check your inbox for instructions.')
        }
      } else if (mode === 'reset') {
        const { error: updateError } = await updatePassword(password)
        if (updateError) {
          setError(updateError)
        } else {
          setNotice('Password updated successfully! You can now sign in.')
          switchMode('signin')
        }
      }
    } catch (err) {
      setError(err?.message || 'An unexpected error occurred.')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleLogin() {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const { error: oauthError } = await signInWithOAuth('google')
      if (oauthError) setError(oauthError)
    } catch (err) {
      setError(err?.message || 'Failed to connect to Google.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center sm:text-left">
        <h1 className="font-display text-2xl text-ink">
          {mode === 'signin' && 'Welcome back'}
          {mode === 'signup' && 'Create your account'}
          {mode === 'magiclink' && 'Magic link sign in'}
          {mode === 'forgot' && 'Reset password'}
          {mode === 'reset' && 'Set new password'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'signin' && 'Sign in to sync your journal across your devices.'}
          {mode === 'signup' && 'Your journal is private — only you can read it.'}
          {mode === 'magiclink' && "We'll email you a passwordless sign-in link."}
          {mode === 'forgot' && "Enter your email and we'll send a recovery link."}
          {mode === 'reset' && 'Choose a secure new password for your account.'}
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

      {/* Social Logins (Google) — available for signin & signup */}
      {(mode === 'signin' || mode === 'signup') && (
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-2 active:scale-[0.99] disabled:opacity-50 shadow-sm"
          >
            <GoogleIcon className="h-4.5 w-4.5" />
            Continue with Google
          </button>

          <div className="flex items-center gap-2 my-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-faint">or continue with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {mode === 'signup' && (
          <div>
            <label htmlFor="auth-display-name" className="mb-1 block text-sm font-medium text-muted">
              Display Name (optional)
            </label>
            <input
              id="auth-display-name"
              type="text"
              autoComplete="name"
              placeholder="e.g. Maya"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
            />
          </div>
        )}

        {mode !== 'reset' && (
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-sm font-medium text-muted">
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </div>
        )}

        {mode !== 'magiclink' && mode !== 'forgot' && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="auth-password" className="text-sm font-medium text-muted">
                {mode === 'reset' ? 'New Password' : 'Password'}
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs text-accent hover:underline"
                >
                  Forgot password?
                </button>
              )}
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
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50 shadow-sm"
        >
          {busy
            ? 'Please wait…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'magiclink'
                  ? 'Send Magic Link'
                  : mode === 'forgot'
                    ? 'Send Reset Link'
                    : 'Update Password'}
        </button>
      </form>

      {/* Mode navigation links */}
      <div className="mt-5 space-y-2 text-center text-sm text-muted">
        {mode === 'signin' && (
          <>
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
            <div>
              Prefer passwordless?{' '}
              <button
                type="button"
                onClick={() => switchMode('magiclink')}
                className="text-accent underline-offset-2 hover:underline"
              >
                Email me a Magic Link
              </button>
            </div>
          </>
        )}

        {mode === 'signup' && (
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

        {(mode === 'magiclink' || mode === 'forgot' || mode === 'reset') && (
          <div>
            Remembered your credentials?{' '}
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>

    </div>
  )
}