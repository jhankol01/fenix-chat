import { useState, useEffect, useRef } from 'react'
import { WifiOff, Loader2, Wifi } from 'lucide-react'
import { getSocket } from '../../lib/socket'
import './ConnectionStatus.css'

/**
 * 🔥 ConnectionStatus Banner
 *
 * Muestra un banner en la parte superior de la pantalla
 * según el estado de la conexión WebSocket:
 *   - disconnected:  Banner rojo  — "Sin conexión — Verificando..."
 *   - reconnecting:  Banner amber — "Reconectando..." con spinner
 *   - reconnected:   Banner verde — "¡Conectado!" (auto-hide 2s)
 *   - connected:     Oculto (default)
 */

const STATUS_CONFIG = {
  disconnected: {
    icon: WifiOff,
    text: 'Sin conexión — Verificando...',
    modifier: 'disconnected',
    iconSpin: false,
  },
  reconnecting: {
    icon: Loader2,
    text: 'Reconectando...',
    modifier: 'reconnecting',
    iconSpin: true,
  },
  reconnected: {
    icon: Wifi,
    text: '¡Conectado!',
    modifier: 'reconnected',
    iconSpin: false,
  },
}

function ConnectionStatus() {
  const [status, setStatus] = useState('connected') // connected | disconnected | reconnecting | reconnected
  const [hiding, setHiding] = useState(false)
  const hideTimerRef = useRef(null)
  const wasDisconnectedRef = useRef(false)

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    function handleConnect() {
      // Solo mostrar "reconectado" si hubo una desconexión previa
      if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false
        setStatus('reconnected')
        setHiding(false)

        // Auto-ocultar después de 2 segundos
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = setTimeout(() => {
          setHiding(true)
          // Después de la animación de salida, restablecer a 'connected'
          setTimeout(() => {
            setStatus('connected')
            setHiding(false)
          }, 250)
        }, 2000)
      } else {
        setStatus('connected')
      }
    }

    function handleDisconnect() {
      wasDisconnectedRef.current = true
      clearTimeout(hideTimerRef.current)
      setHiding(false)
      setStatus('disconnected')
    }

    function handleReconnectAttempt() {
      wasDisconnectedRef.current = true
      clearTimeout(hideTimerRef.current)
      setHiding(false)
      setStatus('reconnecting')
    }

    function handleReconnect() {
      handleConnect()
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('reconnect_attempt', handleReconnectAttempt)
    socket.on('reconnect', handleReconnect)

    return () => {
      clearTimeout(hideTimerRef.current)
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('reconnect_attempt', handleReconnectAttempt)
      socket.off('reconnect', handleReconnect)
    }
  }, [])

  // No renderizar nada si estamos conectados normalmente
  if (status === 'connected') return null

  const config = STATUS_CONFIG[status]
  if (!config) return null

  const Icon = config.icon

  return (
    <div
      className={`connection-status connection-status--${config.modifier}${hiding ? ' connection-status--hiding' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`connection-status__icon${config.iconSpin ? ' connection-status__icon--spin' : ''}`}
      >
        <Icon size={16} />
      </span>
      <span className="connection-status__text">{config.text}</span>
    </div>
  )
}

export default ConnectionStatus
