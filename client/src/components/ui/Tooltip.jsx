import { useState, useRef } from 'react'
import './Tooltip.css'

/**
 * Tooltip que aparece en hover con un pequeño delay.
 * @param {string} content - Texto del tooltip
 * @param {string} position - 'top' | 'right' | 'bottom' | 'left'
 * @param {number} delay - Delay en ms antes de mostrar
 */
function Tooltip({
  children,
  content,
  position = 'top',
  delay = 300,
  className = '',
}) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef(null)

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay)
  }

  const hide = () => {
    clearTimeout(timeoutRef.current)
    setVisible(false)
  }

  if (!content) return children

  return (
    <div
      className={`tooltip-wrapper ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      <div
        className={`tooltip tooltip--${position} ${visible ? 'tooltip--visible' : ''}`}
        role="tooltip"
      >
        {content}
      </div>
    </div>
  )
}

export default Tooltip
