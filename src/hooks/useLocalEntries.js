import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'daily-ink-entries'

function readEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function useLocalEntries() {
  const [entries, setEntries] = useState(readEntries)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  const saveEntry = useCallback((key, content) => {
    setEntries((current) => ({
      ...current,
      [key]: {
        content,
        updatedAt: new Date().toISOString(),
      },
    }))
  }, [])

  return { entries, saveEntry }
}
