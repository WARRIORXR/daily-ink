import { useEffect, useState } from 'react'
import { useLocalEntries } from '../hooks/useLocalEntries'
import { useToday } from '../hooks/useToday'

export default function Journal() {
  const today = useToday()
  const { entries, saveEntry } = useLocalEntries()
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setContent(entries[today.key]?.content ?? '')
  }, [entries, today.key])

  function handleSave(event) {
    event.preventDefault()
    saveEntry(today.key, content)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent">Today</p>
        <h1 className="mt-2 font-display text-3xl text-stone-900">{today.label}</h1>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="What stayed with you today?"
          className="min-h-80 w-full resize-y rounded-2xl border border-stone-200 bg-white/70 p-5 text-lg leading-8 text-stone-800 outline-none ring-accent/30 placeholder:text-stone-400 focus:ring-4"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-stone-900 px-5 py-2.5 text-sm text-amber-50 hover:bg-stone-800"
          >
            Save entry
          </button>
          {saved ? <span className="text-sm text-accent">Saved</span> : null}
        </div>
      </form>
    </section>
  )
}
