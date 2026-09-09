/* Optional client-side encryption (AES-GCM, key derived from a passphrase via PBKDF2). */

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

export { deriveKey, fromB64, toB64 }