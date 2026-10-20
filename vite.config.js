import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'

// Fill the service worker's precache list with this build's hashed files.
function swPrecache() {
  let assets = []
  let outDir = 'dist'
  return {
    name: 'daily-ink-sw-precache',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    generateBundle(_, bundle) {
      assets = Object.keys(bundle)
        .filter((file) => /\.(js|css|wasm|woff2?)$/.test(file))
        .map((file) => `/${file}`)
    },
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js')
      const version = Date.now().toString(36)
      const source = readFileSync(swPath, 'utf8')
        .replace("'__BUILD_VERSION__'", JSON.stringify(version))
        .replace("'__BUILD_ASSETS__'", JSON.stringify(assets))
      writeFileSync(swPath, source)
    },
  }
}

function assertPublicKey(key) {
  if (key.startsWith('sb_secret_')) {
    throw new Error('The Supabase key in your env is a secret key. Use the publishable/anon key.')
  }
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString())
    if (payload.role === 'service_role') {
      throw new Error('The Supabase key in your env is the service_role key. Use the anon key.')
    }
  } catch (err) {
    if (/service_role/.test(err.message)) throw err
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const getEnv = (key) => process.env[key] || env[key] || ''

  // Accept common env var names so a Next.js-style tutorial env file works too.
  const supabaseUrl =
    getEnv('VITE_SUPABASE_URL') ||
    getEnv('SUPABASE_URL') ||
    getEnv('NEXT_PUBLIC_SUPABASE_URL') ||
    'https://yqxayuoerwbuaabemrab.supabase.co'

  const supabaseAnonKey =
    getEnv('VITE_SUPABASE_ANON_KEY') ||
    getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ||
    getEnv('SUPABASE_ANON_KEY') ||
    getEnv('SUPABASE_PUBLISHABLE_KEY') ||
    getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxeGF5dW9lcndidWFhYmVtcmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NzcxMTUsImV4cCI6MjEwNDU1MzExNX0.0qO0M7dDa_IpEziuAS5GXmXKyqoqRJV37dj2qWVZomc'

  // Whatever name the key came from, it ends up in every visitor's browser, so
  // refuse to build with a secret (service role) key by mistake.
  assertPublicKey(supabaseAnonKey)

  return {
    plugins: [react(), tailwindcss(), swPrecache()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  }
})
