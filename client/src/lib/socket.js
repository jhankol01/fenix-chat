import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'

let socket = null

/**
 * Conectar al servidor de WebSocket con token de autenticación
 */
export function connectSocket(token) {
  if (socket?.connected) return socket
  
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  })

  socket.on('connect', () => console.log('🔌 Socket connected'))
  socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason))
  socket.on('connect_error', (err) => console.error('🔌 Socket error:', err.message))

  return socket
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
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export default { connectSocket, getSocket, disconnectSocket }
