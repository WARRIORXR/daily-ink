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