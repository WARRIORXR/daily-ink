import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authProvidersUrl, isSupabaseConfigured, supabase } from '../config/supabaseClient'

const AuthContext = createContext(null)
const GUEST_KEY = 'daily_ink_guest_mode'

function friendlyAuthError(message) {
  const raw = message ?? ''
  if (/column .* does not exist|relation .* does not exist|schema cache/i.test(raw)) {
    return 'Your Supabase project is missing the latest schema. Open the SQL editor, run supabase/schema.sql, then try again.'
  }
  if (/invalid login credentials|wrong password|password.*invalid/i.test(raw)) {
    return 'Wrong username or password.'
  }
  if (/user already registered|duplicate key.*username|database error saving new user/i.test(raw)) {
    return 'That username is already taken.'
  }
  if (/password should be at least/i.test(raw)) {
    return 'Passwords need at least 6 characters.'
  }
  if (/not allowed for this provider|email provider is disabled|signup.*disabled/i.test(raw)) {
    return `Email sign-in is turned off in your Supabase project (one-time setup). Open ${authProvidersUrl} — switch the Email provider ON, uncheck "Confirm email", then Save. You never need to enter an email here.`
  }
  if (/email not confirmed|email rate limit/i.test(raw)) {
    return `Accounts use internal sign-in addresses that can't receive email, so confirmation must be off: open ${authProvidersUrl} → Email → uncheck "Confirm email", then sign in again.`
  }
  if (/rate limit/i.test(raw)) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  return raw || 'Something went wrong. Please try again.'
}

async function logLoginEvent({ username, userId = null, event, success, reason = null }) {
  if (!supabase) return
  try {
    await supabase.from('login_events').insert({
      username: (username ?? '').slice(0, 64),
      user_id: userId,
      event,
      success,
      reason,
      user_agent:
        typeof navigator === 'undefined' ? null : navigator.userAgent.slice(0, 300),
    })
  } catch {
    /* never block authentication on a logging failure */
  }
}

// Generate a deterministic email from username for Supabase Auth.
// This is internal only — the user never sees or enters it.
function generateAuthEmail(username) {
  const clean = username.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
  return `${clean}${Date.now()}@dailyink.app`
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(null)
  const [adminState, setAdminState] = useState({
    userId: null,
    isAdmin: false,
    checked: false,
  })
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

    // Mirror every auth event (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED,
    // USER_UPDATED, SIGNED_OUT). supabase-js already refreshes tokens in the
    // background and when the tab becomes visible again (autoRefreshToken).
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription?.subscription.unsubscribe()
    }
  }, [])

  // Load the admin flag for the signed-in user.
  useEffect(() => {
    const userId = session?.user?.id
    if (!supabase || !userId) return undefined

    let active = true
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setAdminState({ userId, isAdmin: Boolean(data?.is_admin), checked: true })
        }
      })
      .catch(() => {
        if (active) {
          setAdminState({ userId, isAdmin: false, checked: true })
        }
      })

    return () => {
      active = false
    }
  }, [session?.user?.id])

  const exitGuestMode = useCallback(() => {
    setIsGuest(false)
    try {
      localStorage.removeItem(GUEST_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  // Check if a username is free. Anon cannot read the credentials table
  // directly (owner-only RLS), so this goes through the security-definer RPC.
  async function isUsernameAvailable(username) {
    const { data, error } = await supabase.rpc('username_available', {
      p_username: username,
    })
    if (error) {
      return { available: true, error: error.message }
    }
    return { available: data === true, error: null }
  }

  // Sign up: create auth user + store credentials
  const signUp = useCallback(
    async (username, password) => {
      setError(null)
      if (!supabase) {
        return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
      }
      const clean = username.trim()
      try {
        // Check username availability
        const { available, error: checkError } = await isUsernameAvailable(clean)
        if (!available && !checkError) {
          const msg = 'That username is already taken.'
          setError(msg)
          return { error: msg }
        }
        if (checkError) {
          setError(friendlyAuthError(checkError))
          return { error: friendlyAuthError(checkError) }
        }

        // Generate internal email for Supabase Auth
        const email = generateAuthEmail(clean)

        // Create auth user
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: clean },
          },
        })
        if (signUpError) {
          setError(friendlyAuthError(signUpError.message))
          await logLoginEvent({
            username: clean,
            event: 'sign_up',
            success: false,
            reason: signUpError.message,
          })
          return { error: friendlyAuthError(signUpError.message) }
        }

        // Supabase Auth stores and verifies the password itself, so nothing
        // else needs saving here. (Earlier versions also wrote a browser-side
        // hash to public.credentials; sign-in no longer reads it.)

        // If signUp returned a session, we're already logged in
        if (data.session) {
          setSession(data.session)
          exitGuestMode()
        }
        await logLoginEvent({
          username: clean,
          userId: data.user?.id ?? null,
          event: 'sign_up',
          success: true,
        })
        // No session means "Confirm email" is on in Supabase, which blocks
        // sign-in for the synthetic addresses until it is switched off.
        return { error: null, needsConfirmation: !data.session }
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

  // Sign in: resolve the username to its internal sign-in address, then let
  // Supabase Auth verify the password.
  const signIn = useCallback(
    async (username, password) => {
      setError(null)
      if (!supabase) {
        return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
      }
      const clean = username.trim()
      try {
        // The visitor is still anonymous and profiles is owner-only, so the
        // lookup goes through the security-definer RPC.
        const { data: authEmail, error: emailError } = await supabase.rpc(
          'resolve_login_email',
          { p_username: clean },
        )
        if (emailError || !authEmail) {
          const msg = emailError
            ? friendlyAuthError(emailError.message)
            : 'No account found with that username.'
          setError(msg)
          await logLoginEvent({
            username: clean,
            event: 'sign_in',
            success: false,
            reason: emailError?.message ?? 'unknown username',
          })
          return { error: msg }
        }

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        })
        if (signInError) {
          setError(friendlyAuthError(signInError.message))
          await logLoginEvent({
            username: clean,
            event: 'sign_in',
            success: false,
            reason: signInError.message,
          })
          return { error: friendlyAuthError(signInError.message) }
        }
        setSession(data.session)
        exitGuestMode()
        await logLoginEvent({
          username: clean,
          userId: data.session?.user?.id ?? null,
          event: 'sign_in',
          success: true,
        })
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

  const signOut = useCallback(async () => {
    setError(null)
    const current = session?.user
    await logLoginEvent({
      username: current?.user_metadata?.username ?? current?.email ?? '',
      userId: current?.id ?? null,
      event: 'sign_out',
      success: true,
    })
    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch {
        /* ignore network issues on sign out */
      }
    }
    setSession(null)
    exitGuestMode()
  }, [exitGuestMode, session?.user])

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

  // Username from user_metadata (set at signup)
  const username = session?.user?.user_metadata?.username ?? null
  const currentUserId = session?.user?.id ?? null
  const isAdmin =
    adminState.checked && adminState.userId === currentUserId ? adminState.isAdmin : false
  const adminLoading = Boolean(currentUserId) && adminState.userId !== currentUserId

  const value = {
    user: session?.user ?? null,
    username,
    isAdmin,
    adminLoading,
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