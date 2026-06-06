import './Button.css'

/**
 * Botón reutilizable con variantes, tamaños y soporte para iconos.
 * @param {string} variant - 'primary' | 'secondary' | 'danger'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} loading - Muestra spinner de carga
 * @param {boolean} iconOnly - Modo solo-icono (cuadrado)
 * @param {React.ReactNode} icon - Icono a renderizar
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconOnly = false,
  className = '',
  ...props
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    loading && 'btn--loading',
    iconOnly && 'btn--icon-only',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="btn__spinner" />
      ) : (
        <>
          {icon && <span className="btn__icon">{icon}</span>}
          {!iconOnly && children}
        </>
      )}
    </button>
  )
}

export default Button
