import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'

let socket = null
let _onReconnectCallback = null

/**
 * Conectar al servidor de WebSocket con token de autenticación.
 * Reconexión infinita para mantener siempre la conexión viva.
 */
export function connectSocket(token) {
  if (socket?.connected) return socket
  
  // Si ya existe un socket desconectado, limpiarlo
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,    // Max 30s entre intentos
    reconnectionAttempts: Infinity, // NUNCA dejar de intentar
    timeout: 20000,
  })

  socket.on('connect', () => {
    console.log('🔌 Socket connected')
    // Si es una reconexión, recargar datos
    if (_onReconnectCallback) _onReconnectCallback()
  })

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason)
    // Si el servidor nos desconectó, forzar reconexión
    if (reason === 'io server disconnect') {
      socket.connect()
    }
  })

  socket.on('connect_error', (err) => {
    console.error('🔌 Socket error:', err.message)
  })

  // Detectar cuando la pestaña vuelve a estar activa
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', _handleVisibility)
    document.addEventListener('visibilitychange', _handleVisibility)
  }

  return socket
}

/**
 * Cuando el usuario vuelve a la pestaña, verificar conexión
 */
function _handleVisibility() {
  if (document.visibilityState === 'visible' && socket) {
    if (!socket.connected) {
      console.log('🔌 Tab visible again, reconnecting...')
      socket.connect()
    }
    // Siempre recargar datos al volver a la pestaña
    if (_onReconnectCallback) _onReconnectCallback()
  }
}

/**
 * Registrar callback que se ejecuta al reconectar
 * (para recargar conversaciones, mensajes, stories, etc.)
 */
export function onReconnect(callback) {
  _onReconnectCallback = callback
}

/**
 * Obtener la instancia actual del socket
 */
export function getSocket() {
  return socket
}

/**
 * Desconectar el socket y limpiar referencia
 */
export function disconnectSocket() {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', _handleVisibility)
  }
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

export default { connectSocket, getSocket, disconnectSocket, onReconnect }
