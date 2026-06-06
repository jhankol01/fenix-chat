import { useRef, useEffect } from 'react'
import { Check } from 'lucide-react'
import './PinInput.css'

/**
 * PinInput — 6 cajas individuales para código de verificación.
 * @param {string} value - Cadena de hasta 6 dígitos
 * @param {function} onChange - Callback con el nuevo valor (string)
 * @param {boolean} error - Muestra estado de error (shake + borde rojo)
 * @param {boolean} success - Muestra estado de éxito (borde verde + check)
 * @param {boolean} disabled - Deshabilita las cajas
 * @param {string} errorMessage - Mensaje de error a mostrar
 */
function PinInput({
  value = '',
  onChange,
  error = false,
  success = false,
  disabled = false,
  errorMessage = '',
}) {
  const LENGTH = 6
  const inputsRef = useRef([])
  const digits = value.split('').slice(0, LENGTH)

  // Auto-focus a la primera caja al montar
  useEffect(() => {
    if (!disabled) {
      inputsRef.current[0]?.focus()
    }
  }, [disabled])

  const focusBox = (index) => {
    if (index >= 0 && index < LENGTH) {
      inputsRef.current[index]?.focus()
      inputsRef.current[index]?.select()
    }
  }

  const handleChange = (index, e) => {
    const char = e.target.value
    // Solo permitir dígitos
    if (char && !/^\d$/.test(char)) return

    const newDigits = [...digits]
    // Rellenar con vacíos hasta la posición actual
    while (newDigits.length < index) newDigits.push('')
    newDigits[index] = char

    const newValue = newDigits.join('')
    onChange?.(newValue)

    // Avanzar al siguiente campo si se ingresó un dígito
    if (char && index < LENGTH - 1) {
      focusBox(index + 1)
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Si está vacío, retroceder y borrar el anterior
        const newDigits = [...digits]
        newDigits[index - 1] = ''
        onChange?.(newDigits.join(''))
        focusBox(index - 1)
        e.preventDefault()
      } else {
        // Borrar el actual
        const newDigits = [...digits]
        newDigits[index] = ''
        onChange?.(newDigits.join(''))
      }
    } else if (e.key === 'ArrowLeft') {
      focusBox(index - 1)
      e.preventDefault()
    } else if (e.key === 'ArrowRight') {
      focusBox(index + 1)
      e.preventDefault()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (pasted) {
      onChange?.(pasted)
      // Enfocar la última caja llena o la siguiente vacía
      focusBox(Math.min(pasted.length, LENGTH - 1))
    }
  }

  const wrapperClasses = [
    'pin-input',
    error && 'pin-input--error',
    success && 'pin-input--success',
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapperClasses}>
      <div className="pin-input__boxes">
        {Array.from({ length: LENGTH }).map((_, i) => (
          <input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className={`pin-input__box ${digits[i] ? 'pin-input__box--filled' : ''}`}
            value={digits[i] || ''}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            autoComplete="one-time-code"
          />
        ))}
      </div>

      {/* Animación de éxito — checkmark */}
      {success && (
        <div className="pin-input__check">
          <Check size={24} strokeWidth={3} />
        </div>
      )}

      {/* Mensaje de error */}
      {error && errorMessage && (
        <p className="pin-input__error-msg">{errorMessage}</p>
      )}
    </div>
  )
}

export default PinInput
