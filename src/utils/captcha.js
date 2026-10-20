// Set VITE_TURNSTILE_SITE_KEY at build time to show the optional human check.
export const captchaSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
