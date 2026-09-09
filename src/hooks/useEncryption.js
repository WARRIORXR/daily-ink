import { useCallback, useEffect, useState } from 'react'
import {
  decryptContent,
  deriveKey,
  encryptContent,
  encryptText,
  exportKeyToBase64,
  fromB64,
  importKeyFromBase64,
  toB64,
} from '../utils/crypto'

const CONFIG_KEY = 'daily-ink:encryption'
const SESSION_KEY = 'daily-ink:encryption-key'
const VERIFY_TEXT = 'daily-ink-verify'

function readConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const cfg = JSON.parse(raw)
    // A config without a usable verifier can never be unlocked — treat it as
    // disabled so the user can re-enable cleanly.
    if (!cfg?.enabled || !cfg?.verifier?.iv || !cfg?.verifier?.data) return null
    return cfg
  } catch {
    return null
  }
}

function readSessionKey() {
  return sessionStorage.getItem(SESSION_KEY)
}

export function useEncryption() {
  const [config, setConfig] = useState(readConfig)
  const [unlocked, setUnlocked] = useState(Boolean(readSessionKey()))

  useEffect(() => {
    setConfig(readConfig())
    setUnlocked(Boolean(readSessionKey()))
  }, [])

  const getKey = useCallback(async () => {
    const raw = readSessionKey()
    if (!raw) return null
    return importKeyFromBase64(raw)
  }, [])

  const enable = useCallback(async (passphrase) => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await deriveKey(passphrase, salt)
    const { iv, data } = await encryptText(VERIFY_TEXT, key)
    const stored = {
      enabled: true,
      salt: toB64(salt),
      verifier: { iv, data },
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(stored))
    sessionStorage.setItem(SESSION_KEY, await exportKeyToBase64(key))
    setConfig(stored)
    setUnlocked(true)
  }, [])

  const unlock = useCallback(
    async (passphrase) => {
      const stored = readConfig()
      if (!stored?.enabled) return false
      const key = await deriveKey(passphrase, fromB64(stored.salt))
      const plain = await decryptContent(
        `enc:v1:${stored.verifier.iv}:${stored.verifier.data}`,
        key,
      )
      if (plain !== VERIFY_TEXT) return false
      sessionStorage.setItem(SESSION_KEY, await exportKeyToBase64(key))
      setUnlocked(true)
      return true
    },
    [],
  )

  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setUnlocked(false)
  }, [])

  const disable = useCallback(() => {
    localStorage.removeItem(CONFIG_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setConfig(null)
    setUnlocked(false)
  }, [])

  const encrypt = useCallback(
    async (text) => {
      if (!config?.enabled || !unlocked) return { content: text, encrypted: false }
      const key = await getKey()
      if (!key) return { content: text, encrypted: false }
      return encryptContent(text, key)
    },
    [config?.enabled, unlocked, getKey],
  )

  const decrypt = useCallback(
    async (content) => {
      if (typeof content !== 'string' || !content.startsWith('enc:v1:')) return content
      const key = await getKey()
      if (!key) return ''
      return decryptContent(content, key)
    },
    [getKey],
  )

  return {
    enabled: config?.enabled ?? false,
    unlocked,
    enable,
    unlock,
    lock,
    disable,
    encrypt,
    decrypt,
  }
}