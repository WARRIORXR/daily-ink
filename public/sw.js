/* Daily Ink service worker — offline-first for the app shell, stale-while-revalidate for assets. */

// The build replaces these two placeholders (see swPrecache in vite.config.js)
// with a version and the list of built JS/CSS/WebAssembly files, so the whole
// app works offline after the first visit and each deploy installs fresh.
const VERSION = '__BUILD_VERSION__'
const BUILD_ASSETS = '__BUILD_ASSETS__'

const CACHE_NAME = `daily-ink-${VERSION}`
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  ...(Array.isArray(BUILD_ASSETS) ? BUILD_ASSETS : []),
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never cache cross-origin requests (Supabase API, fonts, analytics).
  if (url.origin !== self.location.origin) return

  // Navigations: network first, fall back to the cached app shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
// Daily reminder: tapping it opens (or focuses) the journal.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/journal'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((client) => 'focus' in client)
      if (open) {
        open.navigate?.(url)
        return open.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
