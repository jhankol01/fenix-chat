import { useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import './Modal.css'

/**
 * Selector para elementos enfocables dentro del modal
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Modal con backdrop blur, cierre con Escape y click afuera.
 * Secciones: header (title), body, footer.
 * ♿ Accesibilidad: focus trap, aria-modal, restaurar foco al cerrar.
 */
function Modal({ isOpen, onClose, title, children, footer }) {
  const modalRef = useRef(null)
  const previousFocusRef = useRef(null)

  // Cerrar con Escape + focus trap
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Focus trap: Tab/Shift+Tab stays within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          // Shift+Tab: si estamos en el primer elemento, ir al último
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab: si estamos en el último elemento, ir al primero
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      // Guardar el elemento con foco antes de abrir el modal
      previousFocusRef.current = document.activeElement

      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'

      // Auto-focus al primer elemento enfocable dentro del modal
      requestAnimationFrame(() => {
        if (modalRef.current) {
          const firstFocusable = modalRef.current.querySelector(FOCUSABLE_SELECTOR)
          if (firstFocusable) firstFocusable.focus()
        }
      })
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''

      // Restaurar foco al elemento previo al cerrar
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        <button className="modal__close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        {title && (
          <div className="modal__header">
            <h2 className="modal__title" id="modal-title">{title}</h2>
          </div>
        )}

        <div className="modal__body">{children}</div>

        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )
}

export default Modal
