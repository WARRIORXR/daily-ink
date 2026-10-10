/* Optional client-side encryption (AES-GCM, key derived from a passphrase via PBKDF2).
 * Also provides password hashing (PBKDF2) for the credentials table. */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const ENCRYPTED_PREFIX = 'enc:v1:'
export const isEncrypted = (content) =>
  typeof content === 'string' && content.startsWith(ENCRYPTED_PREFIX)

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

async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    true, // extractable so the session key can persist across reloads
    ['encrypt', 'decrypt'],
  )
}

export async function encryptText(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text))
  return { iv: toB64(iv), data: toB64(new Uint8Array(data)) }
}

export async function decryptText(payload, key) {
  const data = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(payload.iv) },
    key,
    fromB64(payload.data),
  )
  return decoder.decode(data)
}

/** Serialize an entry's content for storage. Returns { content, encrypted }. */
export async function encryptContent(text, key) {
  const { iv, data } = await encryptText(text, key)
  return { content: `${ENCRYPTED_PREFIX}${iv}:${data}`, encrypted: true }
}

export async function decryptContent(content, key) {
  if (!isEncrypted(content) || !key) return content
  const [, , iv, data] = content.split(':')
  try {
    return await decryptText({ iv, data }, key)
  } catch {
    return ''
  }
}

export async function exportKeyToBase64(key) {
  const raw = await crypto.subtle.exportKey('raw', key)
  return toB64(new Uint8Array(raw))
}

export async function importKeyFromBase64(b64) {
  return crypto.subtle.importKey('raw', fromB64(b64), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

/* ──────────────────────────────────────────────────────────────
   Password hashing (PBKDF2-SHA256, 200k iterations)
   Returns a portable string: "v1$iterations$salt$hash" (all base64url)
   ────────────────────────────────────────────────────────────── */
const HASH_VERSION = 'v1'
const HASH_ITERATIONS = 200_000
const HASH_KEY_LENGTH = 32 // 256-bit
const SALT_LENGTH = 16

function toB64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function fromB64Url(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  if (pad) b64 += '='.repeat(4 - pad)
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Hash a password for storage. Returns "v1$iterations$salt$hash". */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const hashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: HASH_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    HASH_KEY_LENGTH * 8,
  )
  return `${HASH_VERSION}$${HASH_ITERATIONS}$${toB64Url(salt)}$${toB64Url(new Uint8Array(hashBits))}`
}

/** Verify a password against a stored hash. */
export async function verifyPassword(password, storedHash) {
  const parts = storedHash.split('$')
  if (parts.length !== 4 || parts[0] !== HASH_VERSION) return false
  const iterations = parseInt(parts[1], 10)
  const salt = fromB64Url(parts[2])
  const expectedHash = fromB64Url(parts[3])

  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const hashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    expectedHash.length * 8,
  )
  const actualHash = new Uint8Array(hashBits)
  // Constant-time comparison
  if (actualHash.length !== expectedHash.length) return false
  let diff = 0
  for (let i = 0; i < actualHash.length; i++) diff |= actualHash[i] ^ expectedHash[i]
  return diff === 0
}

export { deriveKey, fromB64, toB64 }