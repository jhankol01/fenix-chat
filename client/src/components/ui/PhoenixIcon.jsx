/**
 * PhoenixIcon — Logo Fénix Chat (PNG generado)
 * Llama con fénix interior, gradiente azul → violeta → rojo
 */
function PhoenixIcon({ size = 24, className = '' }) {
  return (
    <img
      src="/icons/fenix-flame.png"
      alt="Fénix"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
      draggable={false}
    />
  )
}

export default PhoenixIcon
