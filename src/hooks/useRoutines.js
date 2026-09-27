import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../config/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const STORAGE_KEY = 'daily-ink:routines:v1'

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function normalizeDbRow(row) {
  return {
    id: row.id,
    title: row.title,
    gapDays: row.gap_days,
    startDate: row.start_date,
    color: row.color || '#f59e0b',
    icon: row.icon || '',
    adjustFromLast: row.adjust_from_last ?? true,
    completions: Array.isArray(row.completions) ? row.completions : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function useRoutines() {
  const { user, mode } = useAuth()
  const { toast } = useToast()
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const routinesRef = useRef(routines)
  const loadedFor = useRef(null)

  useEffect(() => {
    routinesRef.current = routines
  }, [routines])

  const persistLocal = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const load = useCallback(async () => {
    const scope = mode === 'server' ? user?.id : 'local'
    if (loadedFor.current === scope && scope !== undefined) return
    loadedFor.current = scope
    setLoading(true)
    setError(null)

    if (mode !== 'server' || !user) {
      setRoutines(readLocal())
      setLoading(false)
      return
    }

    try {
      const { data, error: queryError } = await supabase
        .from('routines')
        .select('*')
        .order('created_at', { ascending: false })

      if (queryError) throw queryError
      setRoutines((data || []).map(normalizeDbRow))
    } catch (err) {
      console.error('Failed to load routines:', err)
      // Fallback to local
      setRoutines(readLocal())
      setError(err?.message ?? 'Could not load routines')
    } finally {
      setLoading(false)
    }
  }, [mode, user])

  useEffect(() => {
    load()
  }, [load])

  // Realtime subscription for Supabase
  useEffect(() => {
    if (mode !== 'server' || !user) return undefined

    const channel = supabase
      .channel(`routines-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'routines', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const { eventType, new: next, old } = payload
          setRoutines((current) => {
            if (eventType === 'DELETE') {
              return current.filter((r) => r.id !== old.id)
            }
            if (eventType === 'INSERT') {
              const item = normalizeDbRow(next)
              if (current.some((r) => r.id === item.id)) return current
              return [item, ...current]
            }
            if (eventType === 'UPDATE') {
              const item = normalizeDbRow(next)
              return current.map((r) => (r.id === item.id ? item : r))
            }
            return current
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mode, user])

  const addRoutine = useCallback(
    async ({ title, gapDays = 3, startDate, color = '#f59e0b', icon = '', adjustFromLast = true }) => {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) {
        toast('Please enter a routine name', 'error')
        return null
      }

      const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const newRoutine = {
        id: tempId,
        title: trimmedTitle,
        gapDays: Number(gapDays),
        startDate,
        color,
        icon,
        adjustFromLast,
        completions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      if (mode !== 'server' || !user) {
        setRoutines((cur) => {
          const next = [newRoutine, ...cur]
          persistLocal(next)
          return next
        })
        toast('Routine created', 'success')
        return newRoutine
      }

      try {
        const payload = {
          user_id: user.id,
          title: trimmedTitle,
          gap_days: Number(gapDays),
          start_date: startDate,
          color,
          icon,
          adjust_from_last: adjustFromLast,
          completions: [],
        }

        const { data, error: insertError } = await supabase
          .from('routines')
          .insert(payload)
          .select()
          .single()

        if (insertError) throw insertError

        const saved = normalizeDbRow(data)
        setRoutines((cur) => [saved, ...cur.filter((r) => r.id !== tempId)])
        toast('Routine created', 'success')
        return saved
      } catch (err) {
        console.error('Error adding routine:', err)
        // Keep in local state as fallback
        setRoutines((cur) => {
          const next = [newRoutine, ...cur]
          persistLocal(next)
          return next
        })
        toast('Saved locally (cloud sync pending)', 'info')
        return newRoutine
      }
    },
    [mode, user, toast, persistLocal],
  )

  const deleteRoutine = useCallback(
    async (id) => {
      setRoutines((cur) => {
        const next = cur.filter((r) => r.id !== id)
        persistLocal(next)
        return next
      })

      if (mode === 'server' && user) {
        try {
          const { error: delError } = await supabase.from('routines').delete().eq('id', id)
          if (delError) throw delError
        } catch (err) {
          console.error('Error deleting routine:', err)
          toast(err?.message ?? 'Could not delete routine from cloud', 'error')
        }
      }
      toast('Routine removed', 'success')
    },
    [mode, user, toast, persistLocal],
  )

  const toggleCompletion = useCallback(
    async (routineId, dateKey) => {
      const routine = routinesRef.current.find((r) => r.id === routineId)
      if (!routine) return

      const isCompleted = routine.completions?.includes(dateKey)
      const nextCompletions = isCompleted
        ? routine.completions.filter((d) => d !== dateKey)
        : [...(routine.completions || []), dateKey]

      const updatedAt = new Date().toISOString()
      const updatedRoutine = { ...routine, completions: nextCompletions, updatedAt }

      setRoutines((cur) => {
        const next = cur.map((r) => (r.id === routineId ? updatedRoutine : r))
        persistLocal(next)
        return next
      })

      if (mode === 'server' && user) {
        try {
          const { error: updateError } = await supabase
            .from('routines')
            .update({
              completions: nextCompletions,
              updated_at: updatedAt,
            })
            .eq('id', routineId)

          if (updateError) throw updateError
        } catch (err) {
          console.error('Error updating completion:', err)
          toast('Saved locally (cloud update pending)', 'info')
        }
      }
    },
    [mode, user, toast, persistLocal],
  )

  return {
    routines,
    loading,
    error,
    addRoutine,
    deleteRoutine,
    toggleCompletion,
    reload: load,
  }
}
