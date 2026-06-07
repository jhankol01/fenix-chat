/**
 * PhoenixIcon — Llama Fénix con gradiente azul → violeta → rosa
 * Usa el path de Material Design "whatshot" — forma de fuego reconocible
 */
function PhoenixIcon({ size = 24, className = '', glow = false }) {
  const id = `ph-${Math.random().toString(36).slice(2, 7)}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 ${size * 0.3}px rgba(124, 58, 237, 0.5))` } : undefined}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="12" y1="22" x2="12" y2="1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="40%" stopColor="#7C3AED" />
          <stop offset="70%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      {/* Outer flame */}
      <path
        d="M13.5 0.67s0.74 2.65 0.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l0.03-0.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5 0.67z"
        fill={`url(#${id}-g)`}
      />
      {/* Inner flame */}
      <path
        d="M11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-0.36 3.6-1.21 4.62-2.58 0.39 1.29 0.59 2.65 0.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"
        fill={`url(#${id}-g)`}
        opacity="0.5"
      />
    </svg>
  )
}

export default PhoenixIcon
