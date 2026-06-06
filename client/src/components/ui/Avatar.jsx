import './Avatar.css'

/* Gradientes para las iniciales basados en hash del nombre */
const GRADIENTS = [
  'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'linear-gradient(135deg, #06d6a0, #059669)',
  'linear-gradient(135deg, #3b82f6, #2563eb)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #ef4444, #dc2626)',
  'linear-gradient(135deg, #ec4899, #db2777)',
  'linear-gradient(135deg, #14b8a6, #0d9488)',
  'linear-gradient(135deg, #f97316, #ea580c)',
]

/** Hash simple para generar gradiente consistente por usuario */
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

/** Obtener iniciales del nombre de usuario */
function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/**
 * Avatar con imagen, fallback de iniciales con gradiente, e indicador de estado.
 * @param {string} size - 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 * @param {string} status - 'online' | 'idle' | 'dnd' | 'offline' | null
 */
function Avatar({
  src,
  name = '',
  size = 'md',
  status,
  className = '',
  ...props
}) {
  const gradient = GRADIENTS[hashString(name) % GRADIENTS.length]
  const initials = getInitials(name)

  return (
    <div className={`avatar avatar--${size} ${className}`} {...props}>
      {src ? (
        <img className="avatar__image" src={src} alt={name} />
      ) : (
        <div
          className="avatar__fallback"
          style={{ background: gradient }}
        >
          {initials}
        </div>
      )}
      {status && (
        <span className={`avatar__status avatar__status--${status}`} />
      )}
    </div>
  )
}

export default Avatar
