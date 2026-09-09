/* Local app lock: PIN (hashed) plus optional platform biometrics via WebAuthn.
   WebAuthn is used purely as a local convenience gate — no attestation or
   server-side verification is involved. */

const PIN_KEY = 'daily-ink:pin'
const BIO_KEY = 'daily-ink:biometric'

export function isBiometricSupported() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.PublicKeyCredential) &&
    window.isSecureContext &&
    navigator.credentials
  )
}

function toB64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromB64(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64urlToBuffer(id) {
  const base64 = id.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return fromB64(padded)
}

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function readPinConfig() {
  try {
    const raw = localStorage.getItem(PIN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const config = { salt: toB64(salt), hash: await sha256Hex(toB64(salt) + pin) }
  localStorage.setItem(PIN_KEY, JSON.stringify(config))
  return config
}

export async function verifyPin(pin) {
  const config = readPinConfig()
  if (!config) return false
  const hash = await sha256Hex(config.salt + pin)
  return hash === config.hash
}

export function clearPin() {
  localStorage.removeItem(PIN_KEY)
  localStorage.removeItem(BIO_KEY)
}

export function hasBiometric() {
  return Boolean(localStorage.getItem(BIO_KEY))
}

export async function registerBiometric() {
  if (!isBiometricSupported()) throw new Error('Biometrics are not supported in this browser')
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Daily Ink' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'journal',
        displayName: 'Journal',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60_000,
      attestation: 'none',
    },
  })
  if (!credential) throw new Error('Biometric setup was cancelled')
  localStorage.setItem(BIO_KEY, credential.id)
  return true
}

export async function authenticateBiometric() {
  if (!isBiometricSupported()) return false
  const id = localStorage.getItem(BIO_KEY)
  if (!id) return false
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: base64urlToBuffer(id) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return Boolean(credential)
  } catch {
    return false
  }
}