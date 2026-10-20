// A small per-browser brake on password guessing. The real limits are
// Supabase Auth's per-IP rate limits; this just stops a script running in the
// page from hammering them and tells a person why they have to wait.
const KEY = 'daily-ink:auth-attempts'
const FREE_ATTEMPTS = 5
const BASE_WAIT_MS = 30_000
const MAX_WAIT_MS = 15 * 60_000

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (saved && Number.isFinite(saved.failures)) return saved
  } catch {
    // fall through
  }
  return { failures: 0, until: 0 }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage unavailable: no brake, Supabase's limits still apply
  }
}

/** Milliseconds left before another attempt is allowed (0 = go ahead). */
export function attemptWait(now = Date.now()) {
  return Math.max(0, read().until - now)
}

export function recordFailure(now = Date.now()) {
  const state = read()
  const failures = state.failures + 1
  const over = failures - FREE_ATTEMPTS
  const wait = over >= 0 ? Math.min(MAX_WAIT_MS, BASE_WAIT_MS * 2 ** over) : 0
  write({ failures, until: wait ? now + wait : 0 })
}

export function recordSuccess() {
  write({ failures: 0, until: 0 })
}

export function waitMessage(ms) {
  const seconds = Math.ceil(ms / 1000)
  const text = seconds < 90 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`
  return `Too many attempts. Please wait ${text} and try again.`
}
