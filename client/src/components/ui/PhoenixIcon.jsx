/**
 * PhoenixIcon — Ícono de fuego/fénix premium con gradientes
 * Inspirado en el concepto visual del usuario
 * Variantes: 'default' (violeta-rosa), 'fire' (azul-rosa-naranja), 'brand' (violeta-azul)
 */
function PhoenixIcon({ size = 24, variant = 'default', className = '', glow = false }) {
  const id = `phoenix-${variant}-${Math.random().toString(36).slice(2, 7)}`
  
  const gradients = {
    default: [
      { offset: '0%', color: '#A855F7' },
      { offset: '50%', color: '#EC4899' },
      { offset: '100%', color: '#F97316' },
    ],
    fire: [
      { offset: '0%', color: '#3B82F6' },
      { offset: '35%', color: '#A855F7' },
      { offset: '65%', color: '#EC4899' },
      { offset: '100%', color: '#F97316' },
    ],
    brand: [
      { offset: '0%', color: '#7C3AED' },
      { offset: '50%', color: '#A855F7' },
      { offset: '100%', color: '#C084FC' },
    ],
  }

  const stops = gradients[variant] || gradients.default

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 ${size * 0.3}px rgba(168, 85, 247, 0.5))` } : undefined}
    >
      <defs>
        <linearGradient id={id} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          {stops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <path
        d="M12 2C12 2 7.5 7 7.5 11.5C7.5 14 9 16 10.5 17C9.5 15.5 9.5 13.5 10.5 12C10.5 12 11 14 12.5 15.5C14 17 14 19 12 22C12 22 19 18 19 12C19 7 12 2 12 2Z"
        fill={`url(#${id})`}
      />
      <path
        d="M12 22C12 22 9 19.5 9 17C9 14.5 12 13 12 13C12 13 11 15 12 16.5C13 18 12 22 12 22Z"
        fill={`url(#${id})`}
        opacity="0.7"
      />
    </svg>
  )
}

export default PhoenixIcon
