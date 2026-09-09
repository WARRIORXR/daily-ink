import { useMemo } from 'react'
import { formatEntryDate, getEntryKey } from '../utils/formatDate'

export function useToday() {
  return useMemo(() => {
    const date = new Date()
    return {
      date,
      key: getEntryKey(date),
      label: formatEntryDate(date),
    }
  }, [])
}
