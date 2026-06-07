/**
 * Fenix Messenger — Service Worker
 * Recibe Push Notifications aunque la app esté cerrada
 */

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

/**
 * Push event — recibido del servidor via Web Push
 */
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch (e) {
    data = { title: 'Fenix Messenger', body: event.data.text() }
  }

  const title = data.title || 'Fenix Messenger'
  const options = {
    body: data.body || 'Nuevo mensaje',
    icon: '/fenix-icon-192.png',
    badge: '/fenix-icon-192.png',
    tag: data.tag || 'fenix-msg',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      conversationId: data.conversationId,
    },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

/**
 * Click en la notificación — abrir/enfocar la app
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una pestaña abierta, enfocarla
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          return client
        }
      }
      // Si no, abrir una nueva
      return clients.openWindow(urlToOpen)
    })
  )
})
