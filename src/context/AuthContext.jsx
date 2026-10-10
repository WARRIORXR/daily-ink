import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../config/supabaseClient'
import { hashPassword, verifyPassword } from '../utils/crypto'

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
  if (/user already registered|duplicate key.*username/i.test(raw)) {
    return 'That username is already taken.'
  }
  if (/password should be at least/i.test(raw)) {
    return 'Passwords need at least 6 characters.'
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

  // Check if username is available in credentials table
  async function isUsernameAvailable(username) {
    const { data, error } = await supabase
      .from('credentials')
      .select('username')
      .eq('username', username)
      .maybeSingle()
    if (error && error.code !== 'PGRST116') {
      return { available: true, error: error.message }
    }
    return { available: !data, error: null }
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

        // Hash password and store in credentials table
        const passwordHash = await hashPassword(password)
        const userId = data.user?.id
        if (userId) {
          const { error: credError } = await supabase.from('credentials').insert({
            user_id: userId,
            username: clean,
            password_hash: passwordHash,
          })
          if (credError) {
            console.error('Failed to store credentials:', credError)
            // Don't fail signup — credentials can be added on first sign-in
          }
        }

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
        // No session means "Confirm email" is on — user must sign in after confirming
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

  // Sign in: verify against credentials table, then sign in with Supabase Auth
  const signIn = useCallback(
    async (username, password) => {
      setError(null)
      if (!supabase) {
        return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
      }
      const clean = username.trim()
      try {
        // Look up credentials
        const { data: cred, error: credError } = await supabase
          .from('credentials')
          .select('user_id, password_hash')
          .eq('username', clean)
          .maybeSingle()
        if (credError) {
          setError(friendlyAuthError(credError.message))
          await logLoginEvent({
            username: clean,
            event: 'sign_in',
            success: false,
            reason: credError.message,
          })
          return { error: friendlyAuthError(credError.message) }
        }
        if (!cred) {
          const msg = 'No account found with that username.'
          setError(msg)
          await logLoginEvent({
            username: clean,
            event: 'sign_in',
            success: false,
            reason: 'unknown username',
          })
          return { error: msg }
        }

        // Verify password hash
        const valid = await verifyPassword(password, cred.password_hash)
        if (!valid) {
          const msg = 'Wrong username or password.'
          setError(msg)
          await logLoginEvent({
            username: clean,
            event: 'sign_in',
            success: false,
            reason: 'invalid password',
          })
          return { error: msg }
        }

        // Sign in with Supabase Auth using the generated email
        // We need to reconstruct the email — it was generated as: clean + timestamp + @dailyink.app
        // Since we can't recover the timestamp, we'll query the auth user by user_id
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(cred.user_id)
        if (userError || !userData?.user?.email) {
          // Fallback: try to sign in with a generated email (may fail if timestamp differs)
          const email = generateAuthEmail(clean)
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
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
        }

        // Sign in with the actual email from auth
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: userData.user.email,
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