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
        detectSessionInUrl: true, // pick up magic-link / email-confirm tokens
      },
      // Realtime: keep channels alive across background tabs.
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null

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