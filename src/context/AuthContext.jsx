import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authEmailDomain, isSupabaseConfigured, supabase } from '../config/supabaseClient'

const AuthContext = createContext(null)
const GUEST_KEY = 'daily_ink_guest_mode'

// Supabase and Postgres word their errors for developers ("column
// profiles.email does not exist"). Translate the ones a journal-keeper can act
// on, and pass the rest through untranslated so real problems stay visible.
// The raw text always reaches the audit log, where it is useful.
function friendlyAuthError(message) {
  const raw = message ?? ''
  if (/column .* does not exist|relation .* does not exist|schema cache/i.test(raw)) {
    return 'Your Supabase project is missing the latest schema. Open the SQL editor, run supabase/schema.sql, then try again.'
  }
  if (/email not confirmed/i.test(raw)) {
    return 'This account still needs email confirmation. In Supabase, turn off "Confirm email" (Authentication -> Providers -> Email), then sign in again.'
  }
  if (/invalid login credentials/i.test(raw)) {
    return 'Wrong username or password.'
  }
  if (/user already registered|duplicate key/i.test(raw)) {
    return 'That username is already taken.'
  }
  if (/password should be at least/i.test(raw)) {
    return 'Passwords need at least 6 characters.'
  }
  if (/email_address_invalid|is invalid/i.test(raw)) {
    return 'Supabase rejected the generated sign-in address. Set VITE_AUTH_EMAIL_DOMAIN to a domain Supabase accepts (it refuses reserved names such as .local).'
  }
  if (/email_provider_disabled|email (signups?|logins?) (are |is )?disabled/i.test(raw)) {
    return 'Supabase is refusing every sign-in: your project has the Email provider switched off, and username accounts sign in through generated email addresses. Fix it in the Supabase dashboard (no code change needed): Authentication -> Sign In / Providers -> Email -> switch on "Enable Email provider" and uncheck "Confirm email". Then try again.'
  }
  if (/rate limit/i.test(raw)) {
    return 'Supabase is rate-limiting confirmation emails, which means "Confirm email" is still on. Turn it off (Authentication -> Providers -> Email) and try again in a few minutes.'
  }
  if (/email not confirmed|confirm/i.test(raw)) {
    return 'Turn off "Confirm email" in Supabase (Authentication -> Providers -> Email) so username accounts can sign in.'
  }
  return raw || 'Something went wrong. Please try again.'
}

// Append an entry to the sign-in audit trail. Logging is best-effort: it must
// never stop someone from signing in, so every failure is swallowed (an older
// project without the login_events table, a flaky network, a blocked insert).
// No password is ever recorded — Supabase hashes it server-side, so a
// plaintext password does not exist anywhere in this app.
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

// Resolve a username to the synthetic sign-in email. Prefers the
// security-definer RPC (which lets profiles stay owner-readable) and falls
// back to a direct read for projects that haven't run the latest schema.sql.
async function resolveLoginEmail(username) {
  const { data, error } = await supabase.rpc('resolve_login_email', {
    p_username: username,
  })
  if (!error) {
    return { email: typeof data === 'string' && data ? data : null, error: null }
  }

  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('email')
    .eq('username', username)
    .single()
  // PGRST116 = no rows found — treat as "user not found"
  if (lookupError && lookupError.code !== 'PGRST116') {
    return { email: null, error: lookupError.message }
  }
  return { email: profile?.email ?? null, error: null }
}

// Friendly "is this username free?" check for signup.
// On an unexpected failure we optimistically report it as available and let
// the unique constraint on profiles.username be the real backstop.
async function isUsernameAvailable(username) {
  const { data, error } = await supabase.rpc('username_available', {
    p_username: username,
  })
  if (!error) return { available: data !== false, error: null }

  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle()
  if (readError) return { available: true, error: readError.message }
  return { available: !existing, error: null }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(null)
  // Admin flag keyed by user id so it can never leak across sign-ins.
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

  // Load the admin flag for the signed-in user. Fails soft on projects that
  // haven't run the latest schema.sql (no is_admin column) — everyone is simply
  // treated as a normal user, and /admin stays locked.
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

  // Look up a user's email by username, then sign in with password.
  const signIn = useCallback(
    async (username, password) => {
      setError(null)
      if (!supabase) {
        return { error: 'Supabase is not configured yet. Add your project credentials in .env.local' }
      }
      const clean = username.trim()
      try {
        // Resolve the username to the account's sign-in email
        const { email, error: lookupError } = await resolveLoginEmail(clean)
        if (lookupError) {
          setError(friendlyAuthError(lookupError))
          await logLoginEvent({
            username: clean,
            event: 'sign_in',
            success: false,
            reason: `lookup failed: ${lookupError}`,
          })
          return { error: friendlyAuthError(lookupError) }
        }

        if (!email) {
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

        // Sign in with Supabase Auth using the resolved email
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
        const { available, error: checkError } = await isUsernameAvailable(clean)
        if (!available && !checkError) {
          const msg = 'That username is already taken.'
          setError(msg)
          return { error: msg }
        }

        // Generate a unique address from the username so Supabase Auth accepts
        // it. The local part is stripped to [a-z0-9] and never left empty, and
        // the domain comes from authEmailDomain (see supabaseClient.js) because
        // Supabase refuses reserved names like .local.
        const localPart = clean.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
        const email = `${localPart}${Date.now()}@${authEmailDomain}`

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

        // The trigger will create the profile row. If signUp returned a session,
        // we're already logged in.
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
        // No session means the project still has "Confirm email" switched on.
        // The account exists but cannot sign in, so tell the form to explain.
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

  // The username the user picked at signup. Falls back to the local part of the
  // synthetic address so the UI never has to show "name1789...@dailyink.app".
  const username =
    session?.user?.user_metadata?.username ??
    (session?.user?.email ? session.user.email.split('@')[0] : null)

  const currentUserId = session?.user?.id ?? null
  const isAdmin =
    adminState.checked && adminState.userId === currentUserId ? adminState.isAdmin : false
  // True only while we are still fetching the flag for the current user.
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
