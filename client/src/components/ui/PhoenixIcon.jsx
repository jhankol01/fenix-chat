/**
 * PhoenixIcon — Logo Fenix Messenger (PNG generado)
 * Llama con fénix interior, gradiente azul → violeta → rojo
 * mix-blend-mode: lighten elimina el fondo negro
 */
function PhoenixIcon({ size = 24, className = '' }) {
  return (
    <img
      src="/icons/fenix-flame.png"
      alt="Fenix"
      width={size}
      height={size}
      className={className}
      style={{
        objectFit: 'contain',
        mixBlendMode: 'lighten',
      }}
      draggable={false}
    />
  )
}

export default PhoenixIcon
