/**
 * Notification Service — Fenix Messenger
 * Push Notifications + Sonidos seleccionables + Browser notifications
 */

import api from './api'

// ═══════════════════════════════════════════════════════
// 🔊 SONIDOS DE NOTIFICACIÓN (5 opciones)
// ═══════════════════════════════════════════════════════

let audioContext = null
function getCtx() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)()
  if (audioContext.state === 'suspended') audioContext.resume()
  return audioContext
}

/**
 * Sonidos disponibles para notificaciones.
 * Cada uno genera un tono único usando Web Audio API.
 */
export const NOTIFICATION_SOUNDS = [
  { id: 'fenix',     label: '🔥 Fenix',     description: 'El ave renace — ascenso de fuego' },
  { id: 'pulse',     label: '💜 Pulse',     description: 'Pulso suave — moderno y discreto' },
  { id: 'chime',     label: '🔔 Chime',     description: 'Campana cristalina — elegante' },
  { id: 'bubble',    label: '💬 Bubble',    description: 'Burbuja pop — divertido y amigable' },
  { id: 'drop',      label: '💧 Drop',      description: 'Gota de agua — relajante y zen' },
  { id: 'none',      label: '🔇 Silencio',  description: 'Sin sonido' },
]

const soundGenerators = {
  // 🔥 Fenix — El ave de fuego renace: ascenso cálido + destello brillante
  fenix(ctx) {
    const now = ctx.currentTime

    // Layer 1: Ember rumble — rumor cálido de brasas (base grave)
    const ember = ctx.createOscillator(), eg = ctx.createGain()
    ember.type = 'triangle'
    ember.frequency.setValueAtTime(180, now)
    ember.frequency.exponentialRampToValueAtTime(400, now + 0.2)
    eg.gain.setValueAtTime(0.15, now)
    eg.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    ember.connect(eg); eg.connect(ctx.destination)
    ember.start(now); ember.stop(now + 0.3)

    // Layer 2: Fire rise — llama ascendente (tono principal)
    const fire = ctx.createOscillator(), fg = ctx.createGain()
    fire.type = 'sine'
    fire.frequency.setValueAtTime(523, now + 0.05)       // C5 — inicio
    fire.frequency.exponentialRampToValueAtTime(1047, now + 0.2) // C6 — sube una octava
    fire.frequency.setValueAtTime(1175, now + 0.22)      // D6 — destello
    fg.gain.setValueAtTime(0, now)
    fg.gain.linearRampToValueAtTime(0.28, now + 0.08)
    fg.gain.setValueAtTime(0.28, now + 0.2)
    fg.gain.exponentialRampToValueAtTime(0.01, now + 0.45)
    fire.connect(fg); fg.connect(ctx.destination)
    fire.start(now + 0.05); fire.stop(now + 0.45)

    // Layer 3: Wing shimmer — brillo de alas (armónico agudo)
    const wing = ctx.createOscillator(), wg = ctx.createGain()
    wing.type = 'sine'
    wing.frequency.setValueAtTime(1568, now + 0.15)      // G6
    wing.frequency.exponentialRampToValueAtTime(2093, now + 0.28) // C7
    wg.gain.setValueAtTime(0, now + 0.15)
    wg.gain.linearRampToValueAtTime(0.12, now + 0.2)
    wg.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
    wing.connect(wg); wg.connect(ctx.destination)
    wing.start(now + 0.15); wing.stop(now + 0.5)

    // Layer 4: Spark — chispa final (micro-destello)
    const spark = ctx.createOscillator(), sg = ctx.createGain()
    spark.type = 'sine'
    spark.frequency.setValueAtTime(2637, now + 0.25)     // E7
    sg.gain.setValueAtTime(0, now + 0.25)
    sg.gain.linearRampToValueAtTime(0.08, now + 0.27)
    sg.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
    spark.connect(sg); sg.connect(ctx.destination)
    spark.start(now + 0.25); spark.stop(now + 0.4)
  },

  // 💜 Pulse — pulso moderno
  pulse(ctx) {
    const now = ctx.currentTime
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(660, now); o.frequency.linearRampToValueAtTime(880, now + 0.15)
    g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.35)
    o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.35)
  },

  // 🔔 Chime — campana cristalina
  chime(ctx) {
    const now = ctx.currentTime
    const freqs = [1046, 1318, 1568] // C6, E6, G6
    freqs.forEach((freq, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = freq
      g.gain.setValueAtTime(0, now + i * 0.1); g.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.4)
      o.connect(g); g.connect(ctx.destination); o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.4)
    })
  },

  // 💬 Bubble — pop burbujeante
  bubble(ctx) {
    const now = ctx.currentTime
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(400, now); o.frequency.exponentialRampToValueAtTime(1200, now + 0.08)
    o.frequency.exponentialRampToValueAtTime(600, now + 0.15)
    g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
    o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.2)
  },

  // 💧 Drop — gota de agua
  drop(ctx) {
    const now = ctx.currentTime
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(1400, now); o.frequency.exponentialRampToValueAtTime(300, now + 0.3)
    g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
    o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.4)
  },

  none() {},
}

/**
 * Reproducir el sonido de notificación seleccionado
 */
export function playNotificationSound(soundId) {
  try {
    const id = soundId || localStorage.getItem('fenix_notification_sound') || 'fenix'
    if (id === 'none') return
    const gen = soundGenerators[id] || soundGenerators.fenix
    gen(getCtx())
  } catch (err) {
    console.warn('Could not play notification sound:', err)
  }
}

/**
 * Preview a notification sound (for settings)
 */
export function previewSound(soundId) {
  try {
    const gen = soundGenerators[soundId] || soundGenerators.fenix
    gen(getCtx())
  } catch (err) {
    console.warn('Could not preview sound:', err)
  }
}

// ═══════════════════════════════════════════════════════
// 🔔 PUSH NOTIFICATIONS — Service Worker + Web Push
// ═══════════════════════════════════════════════════════

let _swRegistration = null

/**
 * Registrar Service Worker y suscribirse a Push Notifications
 */
export async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported')
    return
  }

  try {
    // Registrar Service Worker
    _swRegistration = await navigator.serviceWorker.register('/sw.js')
    console.log('🔔 Service Worker registered')

    // Esperar a que el SW esté activo
    await navigator.serviceWorker.ready

    // Obtener la clave pública VAPID del servidor
    const vapidData = await api.get('/push/vapid-key')
    if (!vapidData?.publicKey) return

    // Verificar si ya estamos suscritos
    let subscription = await _swRegistration.pushManager.getSubscription()

    if (!subscription) {
      // Suscribirse a Push
      subscription = await _swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      })
      console.log('🔔 Push subscription created')
    }

    // Enviar la suscripción al servidor
    await api.post('/push/subscribe', subscription.toJSON())
    console.log('🔔 Push subscription sent to server')
  } catch (err) {
    console.warn('Push notification setup failed:', err)
  }
}

/**
 * Convertir base64 URL-safe a Uint8Array (requerido para VAPID)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ═══════════════════════════════════════════════════════
// 📢 BROWSER NOTIFICATIONS (cuando la tab está abierta)
// ═══════════════════════════════════════════════════════

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

export function showBrowserNotification(title, body, options = {}) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    const notification = new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔥</text></svg>',
      tag: options.tag || 'fenix-chat',
      renotify: true,
      silent: true,
      ...options,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
      if (options.onClick) options.onClick()
    }

    setTimeout(() => notification.close(), 8000)
    return notification
  } catch (err) {
    console.warn('Could not show notification:', err)
  }
}

/**
 * Notificar un mensaje nuevo — sonido + notificación del browser
 */
export function notifyNewMessage({ senderName, content, conversationId, activeConversationId }) {
  const isViewingConversation = conversationId === activeConversationId && document.hasFocus()
  if (isViewingConversation) return

  playNotificationSound()

  if (navigator.vibrate) navigator.vibrate([100, 50, 100])

  const truncatedContent = content.length > 80 ? content.slice(0, 80) + '...' : content
  showBrowserNotification(
    senderName || 'Nuevo mensaje',
    truncatedContent,
    { tag: `fenix-msg-${conversationId}` }
  )

  updateTitleBadge()
}

// ═══════════════════════════════════════════════════════
// 📛 TITLE BADGE
// ═══════════════════════════════════════════════════════

let _originalTitle = 'Fenix Messenger'
export function updateTitleBadge() {
  try {
    const state = window.__fenixChatStore?.getState?.()
    const unread = state?.unreadCounts || {}
    const total = Object.values(unread).reduce((sum, n) => sum + n, 0)
    document.title = total > 0 ? `(${total}) 🔥 Fenix Messenger` : _originalTitle
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => setTimeout(updateTitleBadge, 500))
}

export default {
  playNotificationSound,
  previewSound,
  requestNotificationPermission,
  showBrowserNotification,
  notifyNewMessage,
  updateTitleBadge,
  initPushNotifications,
  NOTIFICATION_SOUNDS,
}
