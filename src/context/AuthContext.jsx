import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../config/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(null)

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
          setSession(data.session)
          setLoading(false)
        }
      })
      .catch(() => active && setLoading(false))

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      subscription?.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    setError(null)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) {
      setError(signInError.message)
      return { error: signInError.message }
    }
    setSession(data.session)
    return { error: null }
  }, [])

  const signUp = useCallback(async (email, password) => {
    setError(null)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      return { error: signUpError.message }
    }
    // Email confirmation may be required before the session exists.
    return {
      error: null,
      needsConfirmation: !data.session,
      email,
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    if (supabase) await supabase.auth.signOut()
    setSession(null)
  }, [])

  const value = {
    user: session?.user ?? null,
    loading,
    error,
    configured: isSupabaseConfigured,
    // 'local'  — no Supabase credentials, everything stays on-device
    // 'guest'  — Supabase configured but not signed in
    // 'server' — signed in, entries sync to Supabase
    mode: !isSupabaseConfigured ? 'local' : session?.user ? 'server' : 'guest',
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}