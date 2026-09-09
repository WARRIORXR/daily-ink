import { createClient } from '@supabase/supabase-js'

// Vite exposes these from .env.local (see vite.config.js).
// Values come from the Supabase dashboard: Project Settings → API.
const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
