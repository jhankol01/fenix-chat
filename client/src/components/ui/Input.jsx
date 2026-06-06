import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import './Input.css'

/**
 * Input con label flotante, toggle de password, ícono prefijo y estado de error.
 */
function Input({
  label,
  type = 'text',
  icon,
  error,
  className = '',
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  const wrapperClasses = [
    'input-wrapper',
    error && 'input-wrapper--error',
    icon && 'input-wrapper--has-icon',
  ]
    .filter(Boolean)
    .join(' ')

  const fieldClasses = [
    'input-field',
    icon && 'input-field--has-icon',
    isPassword && 'input-field--has-toggle',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapperClasses}>
      {icon && <span className="input-icon">{icon}</span>}
      <input
        type={inputType}
        className={fieldClasses}
        placeholder=" "
        {...props}
      />
      {label && <label className="input-label">{label}</label>}
      {isPassword && (
        <button
          type="button"
          className="input-toggle"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
      {error && <p className="input-error-msg">{error}</p>}
    </div>
  )
}

export default Input
