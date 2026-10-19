import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../config/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { idbGet, idbSet, isQuotaError } from '../utils/idb'
import { combineImport } from '../utils/importData'

const STORAGE_KEY = 'daily-ink:data:v1'

function readLegacy() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return { entries: parsed.entries ?? {}, tasks: parsed.tasks ?? {} }
  } catch {
    return null
  }
}

// Local-mode data lives in IndexedDB. Data from older versions is copied over
// from localStorage once, and the old copy is removed only after the new one
// reads back identical. Without IndexedDB everything stays in localStorage.
let localBackend = 'idb'

async function readLocal() {
  try {
    const stored = await idbGet(STORAGE_KEY)
    if (stored) return { entries: stored.entries ?? {}, tasks: stored.tasks ?? {} }
    const legacy = readLegacy()
    if (!legacy) return { entries: {}, tasks: {} }
    await idbSet(STORAGE_KEY, legacy)
    const check = await idbGet(STORAGE_KEY)
    if (JSON.stringify(check) === JSON.stringify(legacy)) localStorage.removeItem(STORAGE_KEY)
    return legacy
  } catch {
    localBackend = 'localStorage'
    return readLegacy() ?? { entries: {}, tasks: {} }
  }
}

async function writeLocal(data) {
  if (localBackend === 'idb') return idbSet(STORAGE_KEY, data)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function errorMessage(err, fallback) {
  return err?.message ?? fallback
}

function applyEntryEvent(state, payload) {
  const { eventType, new: next, old } = payload
  if (eventType === 'DELETE') {
    const result = {}
    for (const [key, entry] of Object.entries(state)) {
      if (entry.id !== old.id) result[key] = entry
    }
    return result
  }
  const dateKey = next.entry_date
  const entry = {
    id: next.id,
    content: next.content,
    mood: next.mood,
    encrypted: next.encrypted,
    createdAt: next.created_at,
    updatedAt: next.updated_at,
  }
  if (eventType === 'UPDATE' && state[dateKey]?.id !== next.id) {
    // entry_date moved: drop the old key that held this row
    const result = {}
    for (const [key, existing] of Object.entries(state)) {
      if (existing.id !== next.id) result[key] = existing
    }
    result[dateKey] = entry
    return result
  }
  return { ...state, [dateKey]: entry }
}

function applyTaskEvent(state, payload) {
  const { eventType, new: next, old } = payload
  if (eventType === 'DELETE') {
    const dateKey = old.entry_date
    return {
      ...state,
      [dateKey]: (state[dateKey] ?? []).filter((t) => t.id !== old.id),
    }
  }
  const fromKey = old?.entry_date
  const dateKey = next.entry_date
  const base = { ...state }
  if (fromKey && fromKey !== dateKey) {
    base[fromKey] = (base[fromKey] ?? []).filter((t) => t.id !== next.id)
  }
  const list = base[dateKey] ?? []
  const task = {
    id: next.id,
    title: next.title,
    done: next.done,
    position: next.position,
  }
  const newList = list.some((t) => t.id === next.id)
    ? list.map((t) => (t.id === next.id ? task : t))
    : [...list, task].sort((a, b) => a.position - b.position)
  return { ...base, [dateKey]: newList }
}

export function useEntries() {
  const { user, mode } = useAuth()
  const { toast } = useToast()
  const [entries, setEntries] = useState({})
  const [tasks, setTasks] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const entriesRef = useRef(entries)
  const tasksRef = useRef(tasks)
  const loadedFor = useRef(null)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  const persistLocal = useCallback(
    (nextEntries, nextTasks) =>
      writeLocal({ entries: nextEntries, tasks: nextTasks }).then(
        () => true,
        (err) => {
          toast(
            isQuotaError(err)
              ? 'Storage is full. Export a backup and free some space, or this page may not be saved.'
              : 'Could not save on this device',
            'error',
          )
          return false
        },
      ),
    [toast],
  )

  const load = useCallback(async () => {
    const scope = mode === 'server' ? user.id : 'local'
    if (loadedFor.current === scope) return
    loadedFor.current = scope
    setLoading(true)
    setError(null)

    if (mode !== 'server') {
      const data = await readLocal()
      setEntries(data.entries)
      setTasks(data.tasks)
      setLoading(false)
      return
    }

    try {
      const [entriesRes, tasksRes] = await Promise.all([
        supabase.from('entries').select('*').order('entry_date'),
        supabase.from('tasks').select('*').order('entry_date').order('position'),
      ])
      if (entriesRes.error) throw entriesRes.error
      if (tasksRes.error) throw tasksRes.error

      const entryMap = {}
      for (const row of entriesRes.data) {
        entryMap[row.entry_date] = {
          id: row.id,
          content: row.content,
          mood: row.mood,
          encrypted: row.encrypted,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      }
      const taskMap = {}
      for (const row of tasksRes.data) {
        ;(taskMap[row.entry_date] ??= []).push({
          id: row.id,
          title: row.title,
          done: row.done,
          position: row.position,
        })
      }
      setEntries(entryMap)
      setTasks(taskMap)
    } catch (err) {
      setError(errorMessage(err, 'Could not load your entries'))
    } finally {
      setLoading(false)
    }
  }, [mode, user])

  useEffect(() => {
    load()
  }, [load])

  // Realtime sync: apply changes made on other devices/tabs as they happen.
  useEffect(() => {
    if (mode !== 'server' || !user) return undefined
    const channel = supabase
      .channel(`entries-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setEntries((current) => applyEntryEvent(current, payload))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setTasks((current) => applyTaskEvent(current, payload))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [mode, user])

  const saveEntry = useCallback(
    async (dateKey, patch) => {
      const current = entriesRef.current[dateKey]
      const base = {
        content: patch.content ?? current?.content ?? '',
        mood: patch.mood !== undefined ? patch.mood : current?.mood ?? null,
        encrypted: patch.encrypted ?? current?.encrypted ?? false,
      }
      const updatedAt = new Date().toISOString()

      if (mode !== 'server') {
        setEntries((cur) => {
          const next = { ...cur, [dateKey]: { ...(cur[dateKey] ?? {}), ...base, updatedAt } }
          persistLocal(next, tasksRef.current)
          return next
        })
        return
      }

      try {
        let id = current?.id
        // user_id has no column default, and RLS checks auth.uid() = user_id,
        // so inserts without it are rejected.
        const payload = { user_id: user.id, entry_date: dateKey, ...base }
        if (id) {
          const { error: updateError } = await supabase
            .from('entries')
            .update(payload)
            .eq('id', id)
          if (updateError) throw updateError
        } else {
          // Upsert on the (user_id, entry_date) key so a row created on another
          // device (or a racing autosave) is updated instead of failing.
          const { data, error: insertError } = await supabase
            .from('entries')
            .upsert(payload, { onConflict: 'user_id,entry_date' })
            .select('id')
            .single()
          if (insertError) throw insertError
          id = data.id
        }
        setEntries((cur) => ({
          ...cur,
          [dateKey]: { ...(cur[dateKey] ?? {}), id, ...base, updatedAt },
        }))
        return true
      } catch (err) {
        toast(errorMessage(err, 'Could not save this entry'), 'error')
        return false
      }
    },
    [mode, user, toast, persistLocal],
  )

  const deleteEntry = useCallback(
    async (dateKey) => {
      if (mode !== 'server') {
        // Build both maps up front: persisting from inside each updater would
        // write the not-yet-updated entries ref back, resurrecting the entry.
        const nextEntries = { ...entriesRef.current }
        delete nextEntries[dateKey]
        const nextTasks = { ...tasksRef.current }
        delete nextTasks[dateKey]
        entriesRef.current = nextEntries
        tasksRef.current = nextTasks
        persistLocal(nextEntries, nextTasks)
        setEntries(nextEntries)
        setTasks(nextTasks)
        return true
      }
      try {
        const id = entriesRef.current[dateKey]?.id
        if (id) {
          const { error: entriesError } = await supabase.from('entries').delete().eq('id', id)
          if (entriesError) throw entriesError
        }
        // Tasks live in their own table; remove them too so they don't come
        // back on the next load.
        const { error: tasksError } = await supabase
          .from('tasks')
          .delete()
          .eq('entry_date', dateKey)
        if (tasksError) throw tasksError
        setEntries((cur) => {
          const next = { ...cur }
          delete next[dateKey]
          return next
        })
        setTasks((cur) => {
          const next = { ...cur }
          delete next[dateKey]
          return next
        })
        return true
      } catch (err) {
        toast(errorMessage(err, 'Could not delete this entry'), 'error')
        return false
      }
    },
    [mode, toast, persistLocal],
  )

  const saveTasks = useCallback(
    async (dateKey, list) => {
      const normalized = list.map((task, index) => ({ ...task, position: index }))

      if (mode !== 'server') {
        setTasks((cur) => {
          const next = { ...cur, [dateKey]: normalized }
          persistLocal(entriesRef.current, next)
          return next
        })
        return
      }

      const prev = tasksRef.current[dateKey] ?? []

      try {
        const kept = normalized.filter((t) => t.id)
        const added = normalized.filter((t) => !t.id)
        const removedIds = prev.filter((t) => t.id && !kept.some((k) => k.id === t.id)).map((t) => t.id)

        for (const id of removedIds) {
          const { error } = await supabase.from('tasks').delete().eq('id', id)
          if (error) throw error
        }

        const rows = [
          ...kept.map((t) => ({ id: t.id, title: t.title, done: t.done, position: t.position })),
          ...added.map((t) => ({ title: t.title, done: t.done, position: t.position })),
        ]

        if (rows.length > 0) {
          const { data, error } = await supabase
            .from('tasks')
            .upsert(rows.map((r) => ({ user_id: user.id, entry_date: dateKey, ...r })), {
              onConflict: 'id',
              ignoreDuplicates: false,
              // Rows without an id get the column default instead of NULL.
              defaultToNull: false,
            })
            .select('id, title, done, position')
            .order('position')
          if (error) throw error
          setTasks((cur) => ({
            ...cur,
            [dateKey]: data.map((t) => ({
              id: t.id,
              title: t.title,
              done: t.done,
              position: t.position,
            })),
          }))
          return
        }

        setTasks((cur) => ({ ...cur, [dateKey]: [] }))
      } catch (err) {
        toast(errorMessage(err, 'Could not save tasks'), 'error')
      }
    },
    [mode, user, toast, persistLocal],
  )

  /** Import parsed export data with strategy 'merge' or 'replace'. Returns true on success. */
  const importData = useCallback(
    async (imported, strategy) => {
      const current = { entries: entriesRef.current, tasks: tasksRef.current }
      const next = combineImport(current, imported, strategy)

      if (mode !== 'server') {
        if (!(await persistLocal(next.entries, next.tasks))) return false
        entriesRef.current = next.entries
        tasksRef.current = next.tasks
        setEntries(next.entries)
        setTasks(next.tasks)
        return true
      }

      try {
        if (strategy === 'replace') {
          const { error: tasksError } = await supabase.from('tasks').delete().eq('user_id', user.id)
          if (tasksError) throw tasksError
          const { error: entriesError } = await supabase.from('entries').delete().eq('user_id', user.id)
          if (entriesError) throw entriesError
        }
        const newDates = Object.keys(next.entries).filter(
          (date) => strategy === 'replace' || !current.entries[date],
        )
        const entryRows = newDates.map((date) => ({
          user_id: user.id,
          entry_date: date,
          content: next.entries[date].content,
          mood: next.entries[date].mood ?? null,
          encrypted: next.entries[date].encrypted ?? false,
        }))
        const taskRows = Object.entries(next.tasks)
          .filter(([date]) => strategy === 'replace' || !current.tasks[date]?.length)
          .flatMap(([date, list]) =>
            list.map((t) => ({ user_id: user.id, entry_date: date, title: t.title, done: t.done, position: t.position })),
          )
        // Batches keep each request small for journals with thousands of days.
        for (let i = 0; i < entryRows.length; i += 500) {
          const { error } = await supabase
            .from('entries')
            .upsert(entryRows.slice(i, i + 500), { onConflict: 'user_id,entry_date' })
          if (error) throw error
        }
        for (let i = 0; i < taskRows.length; i += 500) {
          const { error } = await supabase.from('tasks').insert(taskRows.slice(i, i + 500))
          if (error) throw error
        }
        loadedFor.current = null
        await load()
        return true
      } catch (err) {
        toast(errorMessage(err, 'Import failed'), 'error')
        loadedFor.current = null
        await load()
        return false
      }
    },
    [mode, user, toast, persistLocal, load],
  )

  return {
    entries,
    tasks,
    loading,
    error,
    saveEntry,
    deleteEntry,
    saveTasks,
    importData,
    mode,
    reload: load,
  }
}