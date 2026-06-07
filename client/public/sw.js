const CACHE_NAME = 'fenix-chat-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icons/fenix-flame.png',
  '/backgrounds/fenix-dark.png',
  '/backgrounds/fenix-light.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Network first for API calls, cache first for static assets
  if (event.request.url.includes('/api/') || event.request.url.includes('socket.io')) {
    return // Don't cache API or socket requests
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
    }).catch(() => caches.match('/index.html'))
  )
})
