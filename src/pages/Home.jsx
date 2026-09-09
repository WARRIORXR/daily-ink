import { Link } from 'react-router-dom'
import { useToday } from '../hooks/useToday'
import { isSupabaseConfigured } from '../utils/supabase'

export default function Home() {
  const today = useToday()

  return (
    <section className="space-y-8">
      <p className="text-sm uppercase tracking-[0.2em] text-accent">Daily journal</p>
      <h1 className="font-display text-4xl leading-tight text-stone-900 sm:text-5xl">
        {today.label}
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-stone-600">
        A quiet place for one page a day. Write locally for now, then connect
        Supabase when you are ready to sync across devices.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/journal"
          className="rounded-full bg-stone-900 px-5 py-2.5 text-sm text-amber-50 hover:bg-stone-800"
        >
          Write today
        </Link>
        <Link
          to="/entries"
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm text-stone-700 hover:bg-paper-dark"
        >
          Browse entries
        </Link>
      </div>
      <p className="text-sm text-stone-500">
        Supabase:{' '}
        {isSupabaseConfigured ? 'connected' : 'not configured (using local storage)'}
      </p>
    </section>
  )
}
