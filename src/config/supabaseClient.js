import { createClient } from '@supabase/supabase-js'

const defaultUrl = 'https://yqxayuoerwbuaabemrab.supabase.co'
const defaultKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxeGF5dW9lcndidWFhYmVtcmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NzcxMTUsImV4cCI6MjEwNDU1MzExNX0.0qO0M7dDa_IpEziuAS5GXmXKyqoqRJV37dj2qWVZomc'

// Vite exposes these from .env.local (see vite.config.js) or standard VITE_ prefixes.
const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  defaultUrl
const rawKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
  defaultKey

export const supabaseUrl = rawUrl.trim()
export const supabaseAnonKey = rawKey.trim()

// Project ref from a "https://<ref>.supabase.co" URL — used to deep-link
// into the dashboard pages the setup hints talk about.
export const supabaseProjectRef =
  supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.(?:co|in)/)?.[1] ?? null

export const authProvidersUrl = supabaseProjectRef
  ? `https://supabase.com/dashboard/project/${supabaseProjectRef}/auth/providers`
  : 'https://supabase.com/dashboard'

// Consider configured only if non-empty and not the default placeholder
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project') &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')),
)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true, // keep the session across reloads (localStorage)
        autoRefreshToken: true, // refresh before expiry, in the background
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null

/**
 * Check the auth settings the username-only flow silently depends on.
 * Daily Ink signs users up/in through Supabase Auth with internal synthetic
 * email addresses, so the project must have the Email provider ON and
 * "Confirm email" OFF. Returns the first blocking issue found, or null.
 * @returns {Promise<{ checked: boolean, issue: 'provider_off' | 'confirm_email_on' | null }>}
 */
export async function checkAuthSetup() {
  if (!supabase) return { checked: false, issue: null }
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    })
    if (!response.ok) return { checked: false, issue: null }
    const settings = await response.json()
    if (settings?.external?.email === false) {
      return { checked: true, issue: 'provider_off' }
    }
    if (settings?.external?.email && settings?.mailer_autoconfirm === false) {
      return { checked: true, issue: 'confirm_email_on' }
    }
    return { checked: true, issue: null }
  } catch {
    return { checked: false, issue: null }
  }
}

/**
 * Diagnostic helper to test whether the current Supabase instance is actually reachable.
 * @returns {Promise<{ ok: boolean, status: 'unconfigured' | 'connected' | 'unreachable' | 'error', message: string }>}
 */
export async function testSupabaseConnection() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'unconfigured',
      message: 'Supabase credentials not set in .env.local',
    }
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
      },
    })

    if (response.ok) {
      return {
        ok: true,
        status: 'connected',
        message: 'Successfully connected to Supabase.',
      }
    }

    if (response.status < 500) {
      return {
        ok: true,
        status: 'connected',
        message: 'Supabase instance responded.',
      }
    }

    return {
      ok: false,
      status: 'error',
      message: `Supabase returned status ${response.status}`,
    }
  } catch (err) {
    return {
      ok: false,
      status: 'unreachable',
      message:
        err?.message?.includes('Failed to fetch') || err?.message?.includes('ENOTFOUND')
          ? 'Cannot reach Supabase host. Please check your project URL or network.'
          : err?.message || 'Network error connecting to Supabase.',
    }
  }
}