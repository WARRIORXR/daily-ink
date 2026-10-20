import { useEffect, useRef } from 'react'
import { captchaSiteKey } from '../utils/captcha'

// Optional Cloudflare Turnstile check. It only appears when
// VITE_TURNSTILE_SITE_KEY is set at build time, and must be paired with
// "Enable CAPTCHA protection" (Turnstile + secret key) in Supabase Auth.

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load the human check'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/** Renders the widget and reports a fresh token (or null when it expires). */
export default function Captcha({ onToken }) {
  const box = useRef(null)
  const tokenRef = useRef(onToken)
  useEffect(() => {
    tokenRef.current = onToken
  })

  useEffect(() => {
    if (!captchaSiteKey) return undefined
    let widgetId = null
    let cancelled = false
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !box.current) return
        widgetId = turnstile.render(box.current, {
          sitekey: captchaSiteKey,
          callback: (token) => tokenRef.current(token),
          'expired-callback': () => tokenRef.current(null),
          'error-callback': () => tokenRef.current(null),
        })
      })
      .catch(() => tokenRef.current(null))
    return () => {
      cancelled = true
      if (widgetId !== null) window.turnstile?.remove(widgetId)
    }
  }, [])

  if (!captchaSiteKey) return null
  return <div ref={box} className="flex min-h-16 justify-center" />
}
