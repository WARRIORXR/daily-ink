// Tiny promise wrapper over one IndexedDB object store (key → value), so
// local-mode data isn't capped by localStorage's ~5 MB limit.
const DB_NAME = 'daily-ink'
const STORE = 'kv'

let dbPromise = null

function openDb() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB is not available'))
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
  })
  return dbPromise
}

function run(mode, action) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = action(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(request.result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const idbGet = (key) => run('readonly', (store) => store.get(key))
export const idbSet = (key, value) => run('readwrite', (store) => store.put(value, key))

export function isQuotaError(err) {
  return err?.name === 'QuotaExceededError' || /quota/i.test(err?.message ?? '')
}
