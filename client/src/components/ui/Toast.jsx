import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, AlertTriangle, Info } from 'lucide-react'
import './Toast.css'

/**
 * 🔥 Toast / Snackbar System
 *
 * Uso desde cualquier parte de la app:
 *   import { toast } from '../components/ui/Toast'
 *   toast.success('Perfil actualizado')
 *   toast.error('Error al guardar')
 *   toast.info('Nueva comunidad disponible')
 *   toast.warning('Conexión inestable')
 *
 * Montar <ToastContainer /> una sola vez en App.jsx.
 */

/* ---- Constantes ---- */
const MAX_TOASTS = 3
const DEFAULT_DURATION = 3000

/* ---- Iconos por tipo ---- */
const ICON_MAP = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
}

/* ============================================
   Module-level state + subscribers
   ============================================ */
let toasts = []
let nextId = 1
const subscribers = new Set()

function notify() {
  subscribers.forEach((fn) => fn([...toasts]))
}

function addToast(type, message, duration = DEFAULT_DURATION) {
  const id = nextId++
  const newToast = { id, type, message, duration, exiting: false }

  toasts = [...toasts, newToast]

  // Si superamos el máximo, marcar los más viejos para salir
  while (toasts.filter((t) => !t.exiting).length > MAX_TOASTS) {
    const oldest = toasts.find((t) => !t.exiting)
    if (oldest) {
      oldest.exiting = true
    }
  }

  notify()
  return id
}

function removeToast(id) {
  // Marcar como exiting primero (para animación)
  toasts = toasts.map((t) => (t.id === id ? { ...t, exiting: true } : t))
  notify()

  // Remover después de la animación
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  }, 150)
}

/**
 * Objeto `toast` exportado — llama métodos desde cualquier módulo.
 */
export const toast = {
  success: (message, duration) => addToast('success', message, duration),
  error: (message, duration) => addToast('error', message, duration),
  warning: (message, duration) => addToast('warning', message, duration),
  info: (message, duration) => addToast('info', message, duration),
}

/* ============================================
   Componente individual: Toast
   ============================================ */
function ToastItem({ id, type, message, duration, exiting }) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (exiting) return
    timerRef.current = setTimeout(() => removeToast(id), duration)
    return () => clearTimeout(timerRef.current)
  }, [id, duration, exiting])

  const Icon = ICON_MAP[type] || Info

  return (
    <div
      className={`toast toast--${type}${exiting ? ' toast--exiting' : ''}`}
      role="alert"
      style={{ '--toast-duration': `${duration}ms` }}
    >
      <span className="toast__icon">
        <Icon size={18} />
      </span>

      <div className="toast__content">
        <p className="toast__message">{message}</p>
      </div>

      <button
        className="toast__close"
        onClick={() => removeToast(id)}
        aria-label="Cerrar notificación"
      >
        <X size={14} />
      </button>

      {/* Barra de progreso auto-dismiss */}
      {!exiting && <div className="toast__progress" />}
    </div>
  )
}

/* ============================================
   Contenedor: renderiza todos los toasts activos
   ============================================ */
export function ToastContainer() {
  const [activeToasts, setActiveToasts] = useState([])

  useEffect(() => {
    // Subscribirse a cambios del estado module-level
    const handler = (newToasts) => setActiveToasts(newToasts)
    subscribers.add(handler)
    return () => subscribers.delete(handler)
  }, [])

  if (activeToasts.length === 0) return null

  return createPortal(
    <div className="toast-container" aria-live="polite" aria-label="Notificaciones">
      {activeToasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>,
    document.body
  )
}

export default ToastContainer
