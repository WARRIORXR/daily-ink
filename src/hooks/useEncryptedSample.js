import { useEffect, useState } from 'react'
import { supabase } from '../config/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { isEncrypted } from '../utils/crypto'

/**
 * On a device that hasn't set up encryption, look for one encrypted entry in
 * the account. If there is one, the journal was encrypted on another device
 * and must be unlocked here before anything is shown or saved.
 */
export function useEncryptedSample(enabled) {
  const { user, mode } = useAuth()
  const [sample, setSample] = useState(null)

  useEffect(() => {
    if (enabled || mode !== 'server' || !user) return undefined
    let active = true
    supabase
      .from('entries')
      .select('content')
      .eq('encrypted', true)
      .limit(1)
      .then(({ data }) => {
        const content = data?.[0]?.content
        if (active) setSample(isEncrypted(content) ? content : null)
      })
    return () => {
      active = false
    }
  }, [enabled, mode, user])

  return enabled ? null : sample
}
