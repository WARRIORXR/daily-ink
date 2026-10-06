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
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(next)
        setLoading(false)
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setLoading(false)
      }
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

  // Look up a user's email by username, then sign in with password.
  const signIn = useCallback(
    async (username, password) => {
      setError(null)
      if (!supabase) {
        return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
      }
      try {
        // Find the user's email by username from the profiles table
        const { data: profile, error: lookupError } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', username.trim())
          .single()

        if (lookupError && lookupError.code !== 'PGRST116') {
          // PGRST116 = no rows found — treat as "user not found"
          setError(lookupError.message)
          return { error: lookupError.message }
        }

        if (!profile) {
          setError('No account found with that username.')
          return { error: 'No account found with that username.' }
        }

        // Sign in with Supabase Auth using the found email
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: profile.email,
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

  // Create a new user with Supabase Auth (email generated from username),
  // then store the username in the profiles table.
  const signUp = useCallback(
    async (username, password) => {
      setError(null)
      if (!supabase) {
        return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
      }
      const clean = username.trim()
      try {
        // Friendly early check for taken usernames. The unique constraint on
        // profiles.username is the real backstop if this check races.
        const { data: existing } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', clean)
          .maybeSingle()
        if (existing) {
          const msg = 'That username is already taken.'
          setError(msg)
          return { error: msg }
        }

        // Generate a unique email from the username so Supabase Auth accepts it
        const email = `${clean.toLowerCase().replace(/[^a-z0-9]/g, '')}${Date.now()}@dailyink.local`

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: clean },
          },
        })
        if (signUpError) {
          setError(signUpError.message)
          return { error: signUpError.message }
        }

        // The trigger will create the profile row. If signUp returned a session,
        // we're already logged in.
        if (data.session) {
          setSession(data.session)
          exitGuestMode()
        }
        return { error: null }
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
    mode,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
