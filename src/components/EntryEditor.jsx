import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEncryption } from '../hooks/useEncryption'
import { useEntries } from '../hooks/useEntries'
import { useEntryContent } from '../hooks/useEntryContent'
import { useToast } from '../context/ToastContext'
import { formatEntryDate, getEntryKey } from '../utils/formatDate'
import { WORD_GOALS, getPrompt, getWordStats, loadWordGoal, saveWordGoal } from '../utils/writing'
import MoodPicker from './MoodPicker'
import TaskList from './TaskList'

export default function EntryEditor({ dateKey }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { entries, tasks, loading, saveEntry, deleteEntry, saveTasks } = useEntries()
  const { encrypt, enabled: encryptionEnabled, unlocked } = useEncryption()

  const entry = entries[dateKey]
  const dayTasks = tasks[dateKey] ?? []
  const plain = useEntryContent(entry)

  const [content, setContent] = useState('')
  const [mood, setMood] = useState(null)
  const [status, setStatus] = useState('idle') // idle | saving | saved
  const [promptOffset, setPromptOffset] = useState(0)
  const [wordGoal, setWordGoal] = useState(loadWordGoal)
  const lastPersisted = useRef({ text: '', mood: null })
  const timerRef = useRef(null)
  const textareaRef = useRef(null)
  const draftKey = `daily-ink:draft:${dateKey}`
  const draftChecked = useRef(false)

  // Pull in changes that came from elsewhere (initial load, another device).
  // Our own save echoing back matches lastPersisted and is skipped, otherwise
  // anything typed while the save was in flight would be overwritten.
  useEffect(() => {
    if (plain === lastPersisted.current.text) return
    const saved = lastPersisted.current.text
    lastPersisted.current = { ...lastPersisted.current, text: plain }
    // Words typed before the saved page finished loading are kept, after it.
    setContent((current) =>
      current && current !== saved && current !== plain && plain ? `${plain}\n\n${current}` : plain,
    )
  }, [plain])

  useEffect(() => {
    const nextMood = entry?.mood ?? null
    if (nextMood === lastPersisted.current.mood) return
    lastPersisted.current = { ...lastPersisted.current, mood: nextMood }
    setMood(nextMood)
  }, [entry?.mood])

  // A page left mid-save (reload, closed tab) can lose the last few words, so
  // unsaved text is also kept in this tab's sessionStorage until the save
  // lands. Encrypted journals skip this: no plaintext is stored anywhere.
  useEffect(() => {
    if (draftChecked.current || loading || plain !== (entry?.content ?? '')) return
    draftChecked.current = true
    let draft = null
    try {
      draft = JSON.parse(sessionStorage.getItem(draftKey))
    } catch {
      // unreadable draft: ignore it
    }
    if (!draft || encryptionEnabled || draft.text === plain) {
      try {
        sessionStorage.removeItem(draftKey)
      } catch {
        // storage unavailable
      }
      return
    }
    setContent((current) => (current === plain ? draft.text : current))
    if (draft.mood !== undefined) setMood(draft.mood)
  }, [loading, plain, entry?.content, encryptionEnabled, draftKey])

  const persist = useCallback(
    async (text, m) => {
      if (text === lastPersisted.current.text && m === lastPersisted.current.mood) return
      const previous = lastPersisted.current
      lastPersisted.current = { text, mood: m }
      setStatus('saving')
      let sealed
      try {
        sealed = await encrypt(text)
      } catch (err) {
        // Locked mid-edit: keep the text on screen and retry once unlocked.
        lastPersisted.current = previous
        setStatus('idle')
        toast(err.message, 'error')
        return
      }
      const ok = await saveEntry(dateKey, {
        content: sealed.content,
        encrypted: sealed.encrypted,
        mood: m,
      })
      // Server saves confirm here. A local save finishes in the background, so
      // its draft is cleared the next time the page opens and matches it.
      if (ok === true) {
        try {
          sessionStorage.removeItem(`daily-ink:draft:${dateKey}`)
        } catch {
          // storage unavailable
        }
      }
      setStatus('saved')
      window.setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1400)
    },
    [dateKey, encrypt, saveEntry, toast],
  )

  // Autosave: at most every 3 seconds while writing, and right away when the
  // editor loses focus, the tab is hidden or the page is left.
  const latest = useRef({ content, mood, persist, encryptionEnabled })
  useLayoutEffect(() => {
    latest.current = { content, mood, persist, encryptionEnabled }
  })

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current)
    timerRef.current = null
    const { content: text, mood: m, persist: save, encryptionEnabled: sealed } = latest.current
    const dirty = text !== lastPersisted.current.text || m !== lastPersisted.current.mood
    if (dirty && !sealed) {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({ text, mood: m }))
      } catch {
        // storage full or unavailable: the normal save still runs
      }
    }
    save(text, m)
  }, [draftKey])

  useEffect(() => {
    const dirty = content !== lastPersisted.current.text || mood !== lastPersisted.current.mood
    if (!dirty || timerRef.current) return
    timerRef.current = window.setTimeout(flush, 3000)
  }, [content, mood, flush])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  async function handleDelete() {
    const confirmed = window.confirm('Delete this entry and its tasks? This cannot be undone.')
    if (!confirmed) return
    const ok = await deleteEntry(dateKey)
    if (!ok) return
    toast('Entry deleted', 'success')
    navigate('/journal')
  }

  // Local calendar day; toISOString() is UTC and is off by a day near midnight.
  const isToday = dateKey === getEntryKey()

  // Today's page opens ready to type, cursor at the end of anything written.
  useEffect(() => {
    if (!isToday) return
    const el = textareaRef.current
    if (!el || document.activeElement === el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [isToday, plain])
  const prompt = getPrompt(dateKey, promptOffset)
  const { words, minutes } = useMemo(() => getWordStats(content), [content])
  const goalProgress = wordGoal ? Math.min(words / wordGoal, 1) : 0

  function insertPrompt() {
    setContent((text) => (text.trim() ? `${text.trimEnd()}\n\n${prompt}\n` : `${prompt}\n`))
  }

  function changeGoal(event) {
    const goal = Number(event.target.value)
    setWordGoal(goal)
    saveWordGoal(goal)
  }

  return (
    <div className="space-y-4">
      {/* Mood + status bar — compact on mobile, side-by-side on desktop */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <MoodPicker value={mood} onChange={setMood} />
        <div className="ml-auto flex items-center gap-2 text-xs sm:text-sm text-faint">
          <span
            className={`h-2 w-2 rounded-full transition ${
              status === 'saving'
                ? 'animate-pulse bg-accent'
                : status === 'saved'
                  ? 'bg-success'
                  : 'bg-border'
            }`}
          />
          <span className="sm:hidden">
            {status === 'saving' ? 'Saving' : status === 'saved' ? 'Saved' : 'Auto-save on'}
          </span>
          <span className="hidden sm:inline">
            {status === 'saving'
              ? 'Saving…'
              : status === 'saved'
                ? 'Saved'
                : 'Autosaves as you write'}
          </span>
          {encryptionEnabled && unlocked ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
              title="Entries are encrypted before they leave this device"
            >
              🔒 encrypted
            </span>
          ) : null}
        </div>
      </div>

      {/* Writing prompt */}
      <div className="flex flex-col gap-3 rounded-2xl border border-clay/25 bg-gradient-to-r from-clay-soft via-accent-soft to-transparent p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-hand text-lg leading-none text-clay">need a spark?</p>
          <p className="mt-1 text-sm text-ink sm:text-base">{prompt}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={insertPrompt}
            className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-on-accent shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:text-sm"
          >
            Use prompt
          </button>
          <button
            type="button"
            onClick={() => setPromptOffset((n) => n + 1)}
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-ink sm:text-sm"
          >
            Another
          </button>
        </div>
      </div>

      <label htmlFor="entry-content" className="sr-only">
        Journal entry
      </label>
      <div className="overflow-hidden rounded-2xl border border-border shadow-card">
        {/* Decorative top bar */}
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
          ref={textareaRef}
          id="entry-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onBlur={flush}
          placeholder={
            isToday
              ? 'What stayed with you today?'
              : `What happened on ${formatEntryDate(dateKey)}?`
          }
          className="editor-paper min-h-[28rem] w-full resize-y px-5 py-4 text-lg sm:text-xl leading-10 sm:leading-12 text-ink outline-none ring-accent/30 placeholder:text-faint focus:ring-4"
          rows={10}
        />
      </div>

      {/* Word count and daily goal */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted sm:text-sm">
        <span>
          <span className="font-medium text-ink">{words}</span> {words === 1 ? 'word' : 'words'}
          {words ? ` · ${minutes} min read` : ''}
        </span>
        <label className="flex items-center gap-1.5">
          <span>Daily goal</span>
          <select
            value={wordGoal}
            onChange={changeGoal}
            className="rounded-full border border-border bg-surface px-2 py-0.5 text-ink outline-none focus:border-accent"
          >
            {WORD_GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {goal ? `${goal} words` : 'Off'}
              </option>
            ))}
          </select>
        </label>
        {wordGoal ? (
          <div className="flex min-w-32 flex-1 items-center gap-2">
            <div
              role="progressbar"
              aria-label="Daily word goal"
              aria-valuemin={0}
              aria-valuemax={wordGoal}
              aria-valuenow={Math.min(words, wordGoal)}
              className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  goalProgress >= 1 ? 'bg-success' : 'bg-gradient-to-r from-accent to-clay'
                }`}
                style={{ width: `${goalProgress * 100}%` }}
              />
            </div>
            <span className={goalProgress >= 1 ? 'text-success' : ''}>
              {goalProgress >= 1 ? 'Goal reached 🎉' : `${Math.round(goalProgress * 100)}%`}
            </span>
          </div>
        ) : null}
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
