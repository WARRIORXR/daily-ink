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