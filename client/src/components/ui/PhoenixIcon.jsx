/**
 * PhoenixIcon — Logo Fénix Chat exacto
 * Llama con gradiente azul → violeta → rosa/magenta
 * Variantes: 'logo' (el principal), 'fire', 'brand'
 */
function PhoenixIcon({ size = 24, variant = 'logo', className = '', glow = false }) {
  const id = `phoenix-${variant}-${Math.random().toString(36).slice(2, 7)}`
  
  const gradients = {
    logo: [
      { offset: '0%', color: '#3B82F6' },
      { offset: '40%', color: '#7C3AED' },
      { offset: '70%', color: '#A855F7' },
      { offset: '100%', color: '#EC4899' },
    ],
    fire: [
      { offset: '0%', color: '#3B82F6' },
      { offset: '40%', color: '#7C3AED' },
      { offset: '70%', color: '#A855F7' },
      { offset: '100%', color: '#EC4899' },
    ],
    brand: [
      { offset: '0%', color: '#7C3AED' },
      { offset: '50%', color: '#A855F7' },
      { offset: '100%', color: '#C084FC' },
    ],
  }

  const stops = gradients[variant] || gradients.logo

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 ${size * 0.25}px rgba(124, 58, 237, 0.5))` } : undefined}
    >
      <defs>
        <linearGradient id={`${id}-main`} x1="32" y1="56" x2="32" y2="4" gradientUnits="userSpaceOnUse">
          {stops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}-inner`} x1="32" y1="56" x2="32" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="50%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
      </defs>
      {/* Outer flame */}
      <path
        d="M32 4C32 4 18 16 18 30C18 38 22 44 28 48C28 48 24 42 26 36C28 30 32 26 32 26C32 26 36 30 38 36C40 42 36 48 36 48C42 44 46 38 46 30C46 16 32 4 32 4Z"
        fill={`url(#${id}-main)`}
      />
      {/* Inner flame */}
      <path
        d="M32 56C32 56 24 50 24 44C24 38 28 34 32 30C36 34 40 38 40 44C40 50 32 56 32 56Z"
        fill={`url(#${id}-inner)`}
        opacity="0.85"
      />
    </svg>
  )
}

export default PhoenixIcon
