import { useCallback, useSyncExternalStore } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  decryptContent,
  decryptText,
  deriveKey,
  encryptContent,
  encryptText,
  fromB64,
  isEncrypted,
  toB64,
} from '../utils/crypto'

const CONFIG_KEY = 'daily-ink:encryption'
const LEGACY_SESSION_KEY = 'daily-ink:encryption-key'
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

// Older versions kept the raw key in sessionStorage; the key now lives only in
// memory, so every reload and every auto-lock asks for the passphrase again.
try {
  sessionStorage.removeItem(LEGACY_SESSION_KEY)
} catch {
  // Storage blocked: nothing to clean up.
}

// Shared store: Layout, the editor, Settings and every entry view each call
// useEncryption, and unlocking in one place must unlock all of them.
let store = { config: readConfig(), key: null }
const listeners = new Set()

function setStore(patch) {
  store = { ...store, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getStore = () => store

/** Encrypt with the current key, for bulk jobs that run right after unlocking. */
export async function sealWithCurrentKey(text) {
  if (!store.key) throw new Error('Your journal is locked. Unlock it first.')
  return encryptContent(text, store.key)
}

/** Decrypt with the current key; throws if locked or the text can't be read. */
export async function openWithCurrentKey(content) {
  if (!isEncrypted(content)) return content
  if (!store.key) throw new Error('Your journal is locked. Unlock it first.')
  const [, , iv, data] = content.split(':')
  return decryptText({ iv, data }, store.key)
}

/** Forget the key (used by auto-lock). Encrypted entries become unreadable until unlocked. */
export function lockEncryption() {
  if (store.key) setStore({ key: null })
}

// Signed-in accounts derive the salt from the user id, so the same passphrase
// gives the same key on every device and synced entries open anywhere.
async function saltFor(userId) {
  if (!userId) return crypto.getRandomValues(new Uint8Array(16))
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`daily-ink:${userId}`),
  )
  return new Uint8Array(digest).slice(0, 16)
}

async function saveConfig(salt, key) {
  const { iv, data } = await encryptText(VERIFY_TEXT, key)
  const config = { enabled: true, salt: toB64(salt), verifier: { iv, data } }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  setStore({ config, key })
}

export function useEncryption() {
  const { user } = useAuth()
  const userId = user?.id
  const state = useSyncExternalStore(subscribe, getStore)

  const enable = useCallback(
    async (passphrase) => {
      const salt = await saltFor(userId)
      await saveConfig(salt, await deriveKey(passphrase, salt))
    },
    [userId],
  )

  /**
   * Unlock with the passphrase. On a device that has never unlocked before,
   * `sample` (any encrypted entry content from the account) proves the
   * passphrase is right before this device is set up.
   */
  const unlock = useCallback(
    async (passphrase, sample) => {
      const config = readConfig()
      if (config) {
        const key = await deriveKey(passphrase, fromB64(config.salt))
        const plain = await decryptContent(
          `enc:v1:${config.verifier.iv}:${config.verifier.data}`,
          key,
        )
        if (plain !== VERIFY_TEXT) return false
        setStore({ config, key })
        return true
      }
      if (!isEncrypted(sample) || !userId) return false
      const salt = await saltFor(userId)
      const key = await deriveKey(passphrase, salt)
      const probe = sample.split(':')
      try {
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: fromB64(probe[2]) },
          key,
          fromB64(probe[3]),
        )
      } catch {
        return false
      }
      await saveConfig(salt, key)
      return true
    },
    [userId],
  )

  const lock = useCallback(() => lockEncryption(), [])

  const disable = useCallback(() => {
    localStorage.removeItem(CONFIG_KEY)
    setStore({ config: null, key: null })
  }, [])

  const enabled = state.config?.enabled ?? false
  const key = state.key

  const encrypt = useCallback(
    async (text) => {
      if (!enabled) return { content: text, encrypted: false }
      // Saving plaintext while locked would silently undo the encryption.
      if (!key) throw new Error('Your journal is locked. Unlock it to save.')
      return encryptContent(text, key)
    },
    [enabled, key],
  )

  const decrypt = useCallback(
    async (content) => {
      if (!isEncrypted(content)) return content
      if (!key) return ''
      return decryptContent(content, key)
    },
    [key],
  )

  return { enabled, unlocked: Boolean(key), enable, unlock, lock, disable, encrypt, decrypt }
}
