import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../config/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const STORAGE_KEY = 'daily-ink:reviews:v1'

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function useReviews() {
  const { user, mode } = useAuth()
  const { toast } = useToast()
  const [reviews, setReviews] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const reviewsRef = useRef(reviews)
  const loadedFor = useRef(null)

  useEffect(() => {
    reviewsRef.current = reviews
  }, [reviews])

  const load = useCallback(async () => {
    const scope = mode === 'server' ? user.id : 'local'
    if (loadedFor.current === scope) return
    loadedFor.current = scope
    setLoading(true)
    setError(null)

    if (mode !== 'server') {
      setReviews(readLocal())
      setLoading(false)
      return
    }

    try {
      const { data, error: queryError } = await supabase
        .from('reviews')
        .select('*')
        .order('entry_date')
      if (queryError) throw queryError
      const map = {}
      for (const row of data) {
        map[row.entry_date] = {
          id: row.id,
          intervalDays: row.interval_days,
          easeFactor: row.ease_factor,
          repetitions: row.repetitions,
          dueDate: row.due_date,
          lastReviewedAt: row.last_reviewed_at,
        }
      }
      setReviews(map)
    } catch (err) {
      setError(err?.message ?? 'Could not load review schedule')
    } finally {
      setLoading(false)
    }
  }, [mode, user])

  useEffect(() => {
    load()
  }, [load])

  const upsertReview = useCallback(
    async (dateKey, schedule) => {
      const payload = {
        entry_date: dateKey,
        interval_days: schedule.intervalDays,
        ease_factor: schedule.easeFactor,
        repetitions: schedule.repetitions,
        due_date: schedule.dueDate,
        last_reviewed_at: new Date().toISOString(),
      }

      if (mode !== 'server') {
        setReviews((cur) => {
          const next = {
            ...cur,
            [dateKey]: {
              ...schedule,
              lastReviewedAt: payload.last_reviewed_at,
            },
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
          return next
        })
        return
      }

      try {
        const existing = reviewsRef.current[dateKey]
        if (existing?.id) {
          const { error } = await supabase
            .from('reviews')
            .update(payload)
            .eq('id', existing.id)
          if (error) throw error
          setReviews((cur) => ({
            ...cur,
            [dateKey]: { ...schedule, id: existing.id, lastReviewedAt: payload.last_reviewed_at },
          }))
        } else {
          const { data, error } = await supabase
            .from('reviews')
            .upsert({ user_id: user.id, ...payload }, { onConflict: 'user_id,entry_date' })
            .select('id')
            .single()
          if (error) throw error
          setReviews((cur) => ({
            ...cur,
            [dateKey]: { ...schedule, id: data.id, lastReviewedAt: payload.last_reviewed_at },
          }))
        }
    } catch (err) {
      toast(err?.message ?? 'Could not save review progress', 'error')
    }
  },
  [mode, user, toast],
)

  const removeReview = useCallback(
    async (dateKey) => {
      if (mode !== 'server') {
        setReviews((cur) => {
          const next = { ...cur }
          delete next[dateKey]
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
          return next
        })
        return
      }
      try {
        const existing = reviewsRef.current[dateKey]
        if (existing?.id) {
          const { error } = await supabase.from('reviews').delete().eq('id', existing.id)
          if (error) throw error
        }
        setReviews((cur) => {
          const next = { ...cur }
          delete next[dateKey]
          return next
        })
      } catch (err) {
        toast(err?.message ?? 'Could not remove review', 'error')
      }
    },
    [mode, toast],
  )

  return { reviews, loading, error, upsertReview, removeReview, reload: load }
}