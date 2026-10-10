import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

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

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  }
})
