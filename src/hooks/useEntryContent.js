import { useEffect, useState } from 'react'
import { useEncryption } from './useEncryption'

/** Returns the plaintext of an entry, decrypting it when needed. */
export function useEntryContent(entry) {
  const { decrypt } = useEncryption()
  const [text, setText] = useState('')

  useEffect(() => {
    let active = true
    decrypt(entry?.content ?? '').then((value) => {
      if (active) setText(value)
    })
    return () => {
      active = false
    }
  }, [entry?.content, decrypt])

  return text
}