import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEncryption } from '../hooks/useEncryption'
import { useEntries } from '../hooks/useEntries'
import { useEntryContent } from '../hooks/useEntryContent'
import { useToast } from '../context/ToastContext'
import { formatEntryDate } from '../utils/formatDate'
import MoodPicker from './MoodPicker'
import TaskList from './TaskList'

export default function EntryEditor({ dateKey }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { entries, tasks, saveEntry, deleteEntry, saveTasks } = useEntries()
  const { encrypt, enabled: encryptionEnabled, unlocked } = useEncryption()

  const entry = entries[dateKey]
  const dayTasks = tasks[dateKey] ?? []
  const plain = useEntryContent(entry)

  const [content, setContent] = useState('')
  const [mood, setMood] = useState(null)
  const [status, setStatus] = useState('idle') // idle | saving | saved
  const lastPersisted = useRef({ text: '', mood: null })
  const timerRef = useRef(null)

  useEffect(() => {
    setContent(plain)
  }, [plain])

  useEffect(() => {
    setMood(entry?.mood ?? null)
    lastPersisted.current = { text: plain, mood: entry?.mood ?? null }
  }, [dateKey, entry?.mood, plain])

  const persist = useCallback(
    async (text, m) => {
      if (text === lastPersisted.current.text && m === lastPersisted.current.mood) return
      lastPersisted.current = { text, mood: m }
      setStatus('saving')
      const { content: stored, encrypted } = await encrypt(text)
      await saveEntry(dateKey, { content: stored, encrypted, mood: m })
      setStatus('saved')
      window.setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1400)
    },
    [dateKey, encrypt, saveEntry],
  )

  // Debounced autosave on typing.
  useEffect(() => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      persist(content, mood)
    }, 900)
    return () => window.clearTimeout(timerRef.current)
  }, [content, mood, persist])

  async function handleDelete() {
    const confirmed = window.confirm('Delete this entry and its tasks? This cannot be undone.')
    if (!confirmed) return
    await deleteEntry(dateKey)
    toast('Entry deleted', 'success')
    navigate('/journal')
  }

  const isToday = dateKey === new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <MoodPicker value={mood} onChange={setMood} />
        <span aria-live="polite" className="ml-auto flex items-center gap-2 text-sm text-faint">
          <span
            className={`h-1.5 w-1.5 rounded-full transition ${
              status === 'saving'
                ? 'animate-pulse bg-accent'
                : status === 'saved'
                  ? 'bg-success'
                  : 'bg-border'
            }`}
          />
          {status === 'saving'
            ? 'Saving…'
            : status === 'saved'
              ? 'Saved'
              : 'Autosaves as you write'}
          {encryptionEnabled && unlocked ? (
            <span
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
              title="Entries are encrypted before they leave this device"
            >
              🔒 encrypted
            </span>
          ) : null}
        </span>
      </div>

      <label htmlFor="entry-content" className="sr-only">
        Journal entry
      </label>
      <div className="overflow-hidden rounded-2xl border border-border shadow-card">
        <div
          aria-hidden="true"
          className="flex h-8 items-center gap-1.5 border-b border-border bg-surface-2/50 px-4"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-danger/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
          <span className="ml-2 font-hand text-sm text-faint">dear diary…</span>
        </div>
        <textarea
          id="entry-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={
            isToday
              ? 'What stayed with you today?'
              : `What happened on ${formatEntryDate(dateKey)}?`
          }
          className="editor-paper min-h-72 w-full resize-y px-5 py-4 text-lg leading-10 text-ink outline-none ring-accent/30 placeholder:text-faint focus:ring-4"
        />
      </div>

      <TaskList tasks={dayTasks} onSave={(list) => saveTasks(dateKey, list)} />

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-full px-4 py-2 text-sm text-danger underline-offset-2 transition hover:bg-danger/10 hover:underline"
        >
          Delete entry
        </button>
        <p aria-hidden="true" className="font-hand text-lg text-faint">
          written with care
        </p>
      </div>
    </div>
  )
}