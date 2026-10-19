import { useCallback, useEffect, useState } from 'react'
import {
  authenticateBiometric,
  clearPin,
  hasBiometric,
  isBiometricSupported,
  readPinConfig,
  registerBiometric,
  setPin,
  verifyPin,
} from '../utils/lock'
import { lockEncryption } from './useEncryption'

// Shared store: multiple components (Layout, LockScreen, Settings) each mount
// their own instance of useLock, so the lock state must live outside React.
const listeners = new Set()
let isLocked = Boolean(readPinConfig())

function setLocked(value) {
  isLocked = value
  for (const listener of listeners) listener(value)
}

function subscribeLock(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Open the PIN lock (used when the encryption passphrase has just been entered). */
export function releasePinLock() {
  if (isLocked) setLocked(false)
}

// Auto-lock: after 5 minutes in the background, the PIN lock closes again and
// the encryption key is forgotten, so the passphrase is needed on return.
export const AUTO_LOCK_MS = 5 * 60 * 1000
let hiddenAt = null
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }
    if (hiddenAt !== null && Date.now() - hiddenAt >= AUTO_LOCK_MS) {
      if (readPinConfig()) setLocked(true)
      lockEncryption()
    }
    hiddenAt = null
  })
}

export function useLock() {
  const [configured, setConfigured] = useState(Boolean(readPinConfig()))
  const [locked, setLockedState] = useState(isLocked)

  useEffect(() => subscribeLock(setLockedState), [])

  const enable = useCallback(async (pin) => {
    await setPin(pin)
    setConfigured(true)
    setLocked(true)
  }, [])

  const unlockWithPin = useCallback(async (pin) => {
    const ok = await verifyPin(pin)
    if (ok) setLocked(false)
    return ok
  }, [])

  const unlockWithBiometric = useCallback(async () => {
    const ok = await authenticateBiometric()
    if (ok) setLocked(false)
    return ok
  }, [])

  const disable = useCallback(() => {
    clearPin()
    setConfigured(false)
    setLocked(false)
  }, [])

  const lock = useCallback(() => setLocked(true), [])

  return {
    configured,
    locked,
    enable,
    disable,
    lock,
    unlockWithPin,
    unlockWithBiometric,
    biometricSupported: isBiometricSupported(),
    hasBiometric: hasBiometric(),
    registerBiometric,
  }
}
