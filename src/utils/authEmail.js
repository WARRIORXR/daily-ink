// Supabase Auth needs an email, but Daily Ink only asks for a username. The
// sign-in address is derived from the username alone, so signing in needs no
// lookup (nothing for strangers to query) and the address never reveals the
// username itself. supabase/schema.sql computes the same value in SQL to
// migrate older accounts, and tools/backup.py does it in Python.
export const AUTH_EMAIL_DOMAIN = 'users.dailyink.app'

export function normalizeUsername(username) {
  return (username ?? '').trim().toLowerCase()
}

export async function authEmailFor(username) {
  const bytes = new TextEncoder().encode(normalizeUsername(username))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const hex = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `u-${hex.slice(0, 40)}@${AUTH_EMAIL_DOMAIN}`
}
