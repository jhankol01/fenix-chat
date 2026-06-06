import './Badge.css'

/**
 * Badge de notificación con contador.
 * @param {number} count - Número a mostrar
 * @param {string} variant - 'brand' | 'accent' | 'danger'
 * @param {boolean} pulse - Animar con pulse
 */
function Badge({ count, variant = 'brand', pulse = false, className = '' }) {
  if (!count || count <= 0) return null

  const display = count > 99 ? '99+' : count

  return (
    <span
      className={`badge badge--${variant} ${pulse ? 'badge--pulse' : ''} ${className}`}
    >
      {display}
    </span>
  )
}

export default Badge
