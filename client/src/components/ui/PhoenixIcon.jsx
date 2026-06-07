/**
 * PhoenixIcon — Logo Fénix Chat 
 * Llama estilizada con gradiente azul → violeta → rosa
 */
function PhoenixIcon({ size = 24, variant = 'logo', className = '', glow = false }) {
  const id = `ph-${Math.random().toString(36).slice(2, 7)}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 ${size * 0.3}px rgba(124, 58, 237, 0.6))` } : undefined}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="12" y1="22" x2="12" y2="1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="35%" stopColor="#7C3AED" />
          <stop offset="65%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <path
        d="M12 1C12 1 8.5 5.5 8.5 8.5C8.5 10.5 9.5 11.5 10 12C9 10 10 8 12 6C14 8 15 10 14 12C14.5 11.5 15.5 10.5 15.5 8.5C15.5 5.5 12 1 12 1ZM7 13C7 13 5 15.5 5 17.5C5 20 7.5 22 10 22C8 21 7 19.5 7 17.5C7 16 8 14.5 9 13.5C8 14.5 7.5 13.5 7 13ZM12 11C12 11 8 15 8 18C8 20.2 9.8 22 12 22C14.2 22 16 20.2 16 18C16 15 12 11 12 11ZM12 20C10.9 20 10 19.1 10 18C10 16.5 12 14 12 14C12 14 14 16.5 14 18C14 19.1 13.1 20 12 20Z"
        fill={`url(#${id}-g)`}
      />
    </svg>
  )
}

export default PhoenixIcon
