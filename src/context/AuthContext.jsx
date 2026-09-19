import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../config/supabaseClient'

const AuthContext = createContext(null)
const GUEST_KEY = 'daily_ink_guest_mode'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(null)
  const [_isGuest, setIsGuest] = useState(() => {
    try {
      return localStorage.getItem(GUEST_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    try {
      return (
        window.location.hash.includes('type=recovery') ||
        window.location.search.includes('recovery=true')
      )
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data?.session ?? null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true)
      }
      setSession(next)
      setLoading(false)
    })

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.refreshSession().catch(() => {
          /* handled by onAuthStateChange */
        })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      active = false
      subscription?.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const exitGuestMode = useCallback(() => {
    setIsGuest(false)
    try {
      localStorage.removeItem(GUEST_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const signIn = useCallback(
    async (email, password) => {
      setError(null)
      if (!supabase) {
        return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
      }
      try {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          setError(signInError.message)
          return { error: signInError.message }
        }
        setSession(data.session)
        exitGuestMode()
        return { error: null }
      } catch (err) {
        const msg =
          err?.message?.includes('Failed to fetch') || err?.message?.includes('ENOTFOUND')
            ? 'Unable to reach Supabase. Check your project URL in .env.local and internet connection.'
            : err?.message || 'Sign in failed.'
        setError(msg)
        return { error: msg }
      }
    },
    [exitGuestMode],
  )

  const signUp = useCallback(
    async (email, password, displayName = '') => {
      setError(null)
      if (!supabase) {
        return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
      }
      try {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: displayName ? { data: { display_name: displayName } } : undefined,
        })
        if (signUpError) {
          setError(signUpError.message)
          return { error: signUpError.message }
        }
        if (data.session) {
          setSession(data.session)
          exitGuestMode()
        }
        return {
          error: null,
          needsConfirmation: !data.session,
          email,
        }
      } catch (err) {
        const msg =
          err?.message?.includes('Failed to fetch') || err?.message?.includes('ENOTFOUND')
            ? 'Unable to reach Supabase. Check your project URL in .env.local and internet connection.'
            : err?.message || 'Sign up failed.'
        setError(msg)
        return { error: msg }
      }
    },
    [exitGuestMode],
  )

  const signInWithOtp = useCallback(async (email) => {
    setError(null)
    if (!supabase) {
      return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
    }
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })
      if (otpError) {
        setError(otpError.message)
        return { error: otpError.message }
      }
      return { error: null }
    } catch (err) {
      const msg =
        err?.message?.includes('Failed to fetch') || err?.message?.includes('ENOTFOUND')
          ? 'Unable to reach Supabase. Check your project URL in .env.local and internet connection.'
          : err?.message || 'Failed to send magic link.'
      setError(msg)
      return { error: msg }
    }
  }, [])

  const signInWithOAuth = useCallback(async (provider = 'google') => {
    setError(null)
    if (!supabase) {
      return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
    }
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (oauthError) {
        setError(oauthError.message)
        return { error: oauthError.message }
      }
      return { data, error: null }
    } catch (err) {
      const msg =
        err?.message?.includes('Failed to fetch') || err?.message?.includes('ENOTFOUND')
          ? 'Unable to reach Supabase. Check your project URL in .env.local and internet connection.'
          : err?.message || `Failed to sign in with ${provider}.`
      setError(msg)
      return { error: msg }
    }
  }, [])

  const resetPassword = useCallback(async (email) => {
    setError(null)
    if (!supabase) {
      return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
    }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?recovery=true`,
      })
      if (resetError) {
        setError(resetError.message)
        return { error: resetError.message }
      }
      return { error: null }
    } catch (err) {
      const msg =
        err?.message?.includes('Failed to fetch') || err?.message?.includes('ENOTFOUND')
          ? 'Unable to reach Supabase. Check your project URL in .env.local and internet connection.'
          : err?.message || 'Failed to send password reset email.'
      setError(msg)
      return { error: msg }
    }
  }, [])

  const updatePassword = useCallback(async (newPassword) => {
    setError(null)
    if (!supabase) {
      return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
    }
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) {
        setError(updateError.message)
        return { error: updateError.message }
      }
      setIsRecoveryMode(false)
      return { error: null }
    } catch (err) {
      const msg =
        err?.message?.includes('Failed to fetch') || err?.message?.includes('ENOTFOUND')
          ? 'Unable to reach Supabase. Check your project URL in .env.local and internet connection.'
          : err?.message || 'Failed to update password.'
      setError(msg)
      return { error: msg }
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch {
        /* ignore network issues on sign out */
      }
    }
    setSession(null)
    exitGuestMode()
  }, [exitGuestMode])

  // Mode resolution:
  // - 'local'  : Supabase is NOT configured (no credentials) — offline/local-only mode
  // - 'server' : User has an active Supabase session — fully authenticated
  // - 'guest'  : Supabase IS configured but user is not signed in — login required
  //
  // NOTE: When Supabase is configured, login is mandatory. The isGuest flag no longer
  // grants access to core features; it only persists as a legacy localStorage value
  // that is cleared on next sign-in.
  const mode =
    !isSupabaseConfigured
      ? 'local'
      : session?.user
        ? 'server'
        : 'guest'

  const value = {
    user: session?.user ?? null,
    loading,
    error,
    configured: isSupabaseConfigured,
    isRecoveryMode,
    setIsRecoveryMode,
    mode,
    signIn,
    signUp,
    signInWithOtp,
    signInWithOAuth,
    resetPassword,
    updatePassword,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}