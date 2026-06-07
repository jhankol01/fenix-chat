/**
 * Notification Service — Sonido + notificaciones del navegador
 * para mensajes entrantes en Fénix Chat
 */

// --- Sonido de notificación usando Web Audio API ---
let audioContext = null

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioContext
}

/**
 * Reproduce un sonido corto y agradable de notificación
 * Usa Web Audio API (no necesita archivos externos)
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') ctx.resume()

    const now = ctx.currentTime

    // Nota principal — tono agradable
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)        // A5
    osc1.frequency.setValueAtTime(1108.73, now + 0.08) // C#6
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.25)

    // Segunda nota — armonía
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1318.51, now + 0.06) // E6
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.setValueAtTime(0.2, now + 0.06)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.06)
    osc2.stop(now + 0.3)
  } catch (err) {
    console.warn('Could not play notification sound:', err)
  }
}

// --- Notificaciones del navegador ---

/**
 * Solicitar permiso para notificaciones del navegador
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'

  const result = await Notification.requestPermission()
  return result
}

/**
 * Mostrar una notificación del navegador
 */
export function showBrowserNotification(title, body, options = {}) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    const notification = new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔥</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔥</text></svg>',
      tag: options.tag || 'fenix-chat',
      renotify: true,
      silent: true,
      requireInteraction: true,  // stays until user interacts
      ...options,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
      if (options.onClick) options.onClick()
    }

    setTimeout(() => notification.close(), 10000)

    return notification
  } catch (err) {
    console.warn('Could not show notification:', err)
  }
}

/**
 * Notificar un mensaje nuevo — sonido + notificación del browser
 * Solo notifica si NO estamos viendo esa conversación
 */
export function notifyNewMessage({ senderName, content, conversationId, activeConversationId }) {
  // No notificar si estamos viendo esa conversación Y la ventana está enfocada
  const isViewingConversation = conversationId === activeConversationId && document.hasFocus()
  if (isViewingConversation) return

  // Reproducir sonido SIEMPRE
  playNotificationSound()

  // Vibrar en móvil
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100])
  }

  // Mostrar notificación del navegador
  const truncatedContent = content.length > 80 ? content.slice(0, 80) + '...' : content
  showBrowserNotification(
    senderName || 'Nuevo mensaje',
    truncatedContent,
    { tag: `fenix-msg-${conversationId}` }
  )

  // Actualizar el título de la pestaña con conteo
  updateTitleBadge()
}

/**
 * Update page title with unread count badge
 */
let _originalTitle = 'Fénix Chat — Comunidades Simples'
export function updateTitleBadge() {
  try {
    // Dynamic import to avoid circular deps
    const state = window.__fenixChatStore?.getState?.()
    const unread = state?.unreadCounts || {}
    const total = Object.values(unread).reduce((sum, n) => sum + n, 0)
    if (total > 0) {
      document.title = `(${total}) 🔥 Fénix Chat`
    } else {
      document.title = _originalTitle
    }
  } catch (_) {}
}

// Restore title on focus
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    setTimeout(updateTitleBadge, 500)
  })
}

export default {
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
  notifyNewMessage,
  updateTitleBadge,
}
