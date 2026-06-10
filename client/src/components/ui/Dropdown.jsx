import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import './Dropdown.css'

/**
 * 🔥 Dropdown Component
 *
 * Custom-styled select con glassmorphism, keyboard navigation,
 * y posicionamiento automático (arriba/abajo).
 *
 * Uso:
 *   <Dropdown
 *     options={[
 *       { value: 'everyone', label: 'Todos', icon: <Globe size={16} /> },
 *       { value: 'contacts', label: 'Solo contactos' },
 *       { value: 'nobody', label: 'Nadie' },
 *     ]}
 *     value={selected}
 *     onChange={setSelected}
 *     placeholder="Seleccionar..."
 *   />
 */
function Dropdown({ options = [], value, onChange, placeholder = 'Seleccionar...' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [renderAbove, setRenderAbove] = useState(false)

  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const selectedOption = options.find((opt) => opt.value === value)

  /* ---- Abrir / cerrar ---- */
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        // Al abrir, calcular posición
        const trigger = triggerRef.current
        if (trigger) {
          const rect = trigger.getBoundingClientRect()
          const spaceBelow = window.innerHeight - rect.bottom
          setRenderAbove(spaceBelow < 260)
        }
        // Poner foco en la opción seleccionada
        const idx = options.findIndex((opt) => opt.value === value)
        setFocusedIndex(idx >= 0 ? idx : 0)
      }
      return !prev
    })
  }, [options, value])

  const close = useCallback(() => {
    setIsOpen(false)
    setFocusedIndex(-1)
  }, [])

  const selectOption = useCallback(
    (optionValue) => {
      onChange(optionValue)
      close()
      triggerRef.current?.focus()
    },
    [onChange, close]
  )

  /* ---- Click outside ---- */
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        close()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, close])

  /* ---- Keyboard navigation ---- */
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) {
        // Abrir con Enter, Space, ArrowDown, ArrowUp
        if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
          e.preventDefault()
          toggle()
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0))
          break

        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1))
          break

        case 'Enter':
        case ' ':
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            selectOption(options[focusedIndex].value)
          }
          break

        case 'Escape':
          e.preventDefault()
          close()
          triggerRef.current?.focus()
          break

        case 'Tab':
          close()
          break

        default:
          break
      }
    },
    [isOpen, focusedIndex, options, toggle, selectOption, close]
  )

  /* ---- Scroll focused item into view ---- */
  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return
    const menu = menuRef.current
    if (!menu) return
    const item = menu.children[focusedIndex]
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen, focusedIndex])

  return (
    <div
      className={`dropdown${isOpen ? ' dropdown--open' : ''}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      <button
        className="dropdown__trigger"
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={toggle}
      >
        <span className="dropdown__trigger-content">
          {selectedOption?.icon && (
            <span className="dropdown__item-icon">{selectedOption.icon}</span>
          )}
          <span
            className={`dropdown__trigger-label${!selectedOption ? ' dropdown__trigger-label--placeholder' : ''}`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <span className="dropdown__chevron">
          <ChevronDown size={16} />
        </span>
      </button>

      {/* Menu */}
      {isOpen && (
        <div
          className={`dropdown__menu${renderAbove ? ' dropdown__menu--above' : ''}`}
          ref={menuRef}
          role="listbox"
          aria-activedescendant={
            focusedIndex >= 0 ? `dropdown-opt-${options[focusedIndex]?.value}` : undefined
          }
        >
          {options.map((option, index) => {
            const isActive = option.value === value
            const isFocused = index === focusedIndex

            return (
              <button
                key={option.value}
                id={`dropdown-opt-${option.value}`}
                className={`dropdown__item${isActive ? ' dropdown__item--active' : ''}${isFocused ? ' dropdown__item--focused' : ''}`}
                role="option"
                aria-selected={isActive}
                type="button"
                onClick={() => selectOption(option.value)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                {option.icon && (
                  <span className="dropdown__item-icon">{option.icon}</span>
                )}

                <span className="dropdown__item-label">{option.label}</span>

                {isActive && (
                  <span className="dropdown__item-check">
                    <Check size={14} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Dropdown
