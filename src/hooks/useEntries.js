import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../config/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const STORAGE_KEY = 'daily-ink:data:v1'

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { entries: {}, tasks: {} }
    const parsed = JSON.parse(raw)
    return { entries: parsed.entries ?? {}, tasks: parsed.tasks ?? {} }
  } catch {
    return { entries: {}, tasks: {} }
  }
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

  const persistLocal = useCallback((nextEntries, nextTasks) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ entries: nextEntries, tasks: nextTasks }),
    )
  }, [])

  const load = useCallback(async () => {
    const scope = mode === 'server' ? user.id : 'local'
    if (loadedFor.current === scope) return
    loadedFor.current = scope
    setLoading(true)
    setError(null)

    if (mode !== 'server') {
      const data = readLocal()
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
        const payload = { entry_date: dateKey, ...base }
        if (id) {
          const { error: updateError } = await supabase
            .from('entries')
            .update(payload)
            .eq('id', id)
          if (updateError) throw updateError
        } else {
          const { data, error: insertError } = await supabase
            .from('entries')
            .insert(payload)
            .select('id')
            .single()
          if (insertError) throw insertError
          id = data.id
        }
        setEntries((cur) => ({
          ...cur,
          [dateKey]: { ...(cur[dateKey] ?? {}), id, ...base, updatedAt },
        }))
      } catch (err) {
        toast(errorMessage(err, 'Could not save this entry'), 'error')
      }
    },
    [mode, toast, persistLocal],
  )

  const deleteEntry = useCallback(
    async (dateKey) => {
      if (mode !== 'server') {
        setEntries((cur) => {
          const next = { ...cur }
          delete next[dateKey]
          persistLocal(next, tasksRef.current)
          return next
        })
        setTasks((cur) => {
          const next = { ...cur }
          delete next[dateKey]
          persistLocal(entriesRef.current, next)
          return next
        })
        return
      }
      try {
        const { error: entriesError } = await supabase
          .from('entries')
          .delete()
          .eq('id', entriesRef.current[dateKey]?.id)
        if (entriesError) throw entriesError
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
      } catch (err) {
        toast(errorMessage(err, 'Could not delete this entry'), 'error')
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
            .upsert(rows.map((r) => ({ entry_date: dateKey, ...r })), {
              onConflict: 'id',
              ignoreDuplicates: false,
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
    [mode, toast, persistLocal],
  )

  return { entries, tasks, loading, error, saveEntry, deleteEntry, saveTasks, reload: load }
}