import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import './PhoneInput.css'

/**
 * Lista completa de países con código, bandera y nombre.
 * Ordenados por región: LATAM primero, luego el resto.
 */
const COUNTRIES = [
  // --- Caribe ---
  { code: '+1',    flag: '🇩🇴', name: 'República Dominicana', search: 'republica dominicana dominican' },
  { code: '+1',    flag: '🇵🇷', name: 'Puerto Rico', search: 'puerto rico' },
  { code: '+53',   flag: '🇨🇺', name: 'Cuba', search: 'cuba' },
  { code: '+509',  flag: '🇭🇹', name: 'Haití', search: 'haiti' },
  { code: '+1',    flag: '🇯🇲', name: 'Jamaica', search: 'jamaica' },
  { code: '+1',    flag: '🇹🇹', name: 'Trinidad y Tobago', search: 'trinidad tobago' },

  // --- Centroamérica ---
  { code: '+502',  flag: '🇬🇹', name: 'Guatemala', search: 'guatemala' },
  { code: '+503',  flag: '🇸🇻', name: 'El Salvador', search: 'el salvador' },
  { code: '+504',  flag: '🇭🇳', name: 'Honduras', search: 'honduras' },
  { code: '+505',  flag: '🇳🇮', name: 'Nicaragua', search: 'nicaragua' },
  { code: '+506',  flag: '🇨🇷', name: 'Costa Rica', search: 'costa rica' },
  { code: '+507',  flag: '🇵🇦', name: 'Panamá', search: 'panama' },
  { code: '+501',  flag: '🇧🇿', name: 'Belice', search: 'belice belize' },

  // --- Sudamérica ---
  { code: '+58',   flag: '🇻🇪', name: 'Venezuela', search: 'venezuela' },
  { code: '+57',   flag: '🇨🇴', name: 'Colombia', search: 'colombia' },
  { code: '+52',   flag: '🇲🇽', name: 'México', search: 'mexico' },
  { code: '+54',   flag: '🇦🇷', name: 'Argentina', search: 'argentina' },
  { code: '+55',   flag: '🇧🇷', name: 'Brasil', search: 'brasil brazil' },
  { code: '+56',   flag: '🇨🇱', name: 'Chile', search: 'chile' },
  { code: '+51',   flag: '🇵🇪', name: 'Perú', search: 'peru' },
  { code: '+593',  flag: '🇪🇨', name: 'Ecuador', search: 'ecuador' },
  { code: '+591',  flag: '🇧🇴', name: 'Bolivia', search: 'bolivia' },
  { code: '+595',  flag: '🇵🇾', name: 'Paraguay', search: 'paraguay' },
  { code: '+598',  flag: '🇺🇾', name: 'Uruguay', search: 'uruguay' },
  { code: '+592',  flag: '🇬🇾', name: 'Guyana', search: 'guyana' },

  // --- Norteamérica ---
  { code: '+1',    flag: '🇺🇸', name: 'Estados Unidos', search: 'estados unidos usa us' },
  { code: '+1',    flag: '🇨🇦', name: 'Canadá', search: 'canada' },

  // --- Europa (principales) ---
  { code: '+34',   flag: '🇪🇸', name: 'España', search: 'españa spain espana' },
  { code: '+44',   flag: '🇬🇧', name: 'Reino Unido', search: 'reino unido uk united kingdom' },
  { code: '+33',   flag: '🇫🇷', name: 'Francia', search: 'francia france' },
  { code: '+49',   flag: '🇩🇪', name: 'Alemania', search: 'alemania germany' },
  { code: '+39',   flag: '🇮🇹', name: 'Italia', search: 'italia italy' },
  { code: '+351',  flag: '🇵🇹', name: 'Portugal', search: 'portugal' },
  { code: '+31',   flag: '🇳🇱', name: 'Países Bajos', search: 'paises bajos holanda netherlands' },
  { code: '+46',   flag: '🇸🇪', name: 'Suecia', search: 'suecia sweden' },
  { code: '+41',   flag: '🇨🇭', name: 'Suiza', search: 'suiza switzerland' },
]

// Usar un ID único para países con el mismo código (ej: +1 USA vs +1 RD)
const getCountryId = (c) => `${c.code}-${c.flag}`

/**
 * Formatea el número telefónico mientras se escribe.
 */
function formatPhone(value) {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`
}

/**
 * PhoneInput — Selector de país con buscador + campo de teléfono.
 */
function PhoneInput({
  value = '',
  onChange,
  error,
  countryCode = '+58',
  label = 'Número de teléfono',
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)
  const searchRef = useRef(null)

  // Encontrar el país seleccionado (por código + flag para distinguir +1 duplicados)
  const [selectedId, setSelectedId] = useState(() => {
    const found = COUNTRIES.find((c) => c.code === countryCode)
    return found ? getCountryId(found) : getCountryId(COUNTRIES[0])
  })

  const selectedCountry = COUNTRIES.find((c) => getCountryId(c) === selectedId) || COUNTRIES[0]

  // Filtrar países por búsqueda
  const filteredCountries = useMemo(() => {
    if (!search.trim()) return COUNTRIES
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return COUNTRIES.filter((c) => {
      const name = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const s = c.search.toLowerCase()
      const code = c.code
      return name.includes(q) || s.includes(q) || code.includes(q)
    })
  }, [search])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus en el buscador al abrir
      setTimeout(() => searchRef.current?.focus(), 50)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleCountrySelect = (country) => {
    setSelectedId(getCountryId(country))
    onChange?.({ countryCode: country.code, number: value })
    setOpen(false)
    setSearch('')
    inputRef.current?.focus()
  }

  const handleNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
    onChange?.({ countryCode: selectedCountry.code, number: raw })
  }

  const handleToggle = () => {
    setOpen(!open)
    if (open) setSearch('')
  }

  const wrapperClasses = [
    'phone-input',
    error && 'phone-input--error',
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapperClasses} ref={dropdownRef}>
      {label && <span className="phone-input__label">{label}</span>}

      <div className="phone-input__field">
        {/* Botón selector de país */}
        <button
          type="button"
          className="phone-input__selector"
          onClick={handleToggle}
          aria-label="Seleccionar país"
          aria-expanded={open}
        >
          <span className="phone-input__selector-flag">{selectedCountry.flag}</span>
          <span className="phone-input__selector-code">{selectedCountry.code}</span>
          <span className={`phone-input__selector-chevron ${open ? 'phone-input__selector-chevron--open' : ''}`}>
            <ChevronDown size={14} />
          </span>
        </button>

        {/* Input del número */}
        <input
          ref={inputRef}
          type="tel"
          className="phone-input__number"
          value={formatPhone(value)}
          onChange={handleNumberChange}
          placeholder="412 345 6789"
          autoComplete="tel-national"
        />
      </div>

      {/* Dropdown de países con buscador */}
      {open && (
        <div className="phone-input__dropdown" role="listbox">
          {/* Buscador */}
          <div className="phone-input__search">
            <Search size={14} className="phone-input__search-icon" />
            <input
              ref={searchRef}
              type="text"
              className="phone-input__search-input"
              placeholder="Buscar país..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Lista de países */}
          <div className="phone-input__list">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => {
                const id = getCountryId(country)
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={id === selectedId}
                    className={`phone-input__option ${id === selectedId ? 'phone-input__option--active' : ''}`}
                    onClick={() => handleCountrySelect(country)}
                  >
                    <span className="phone-input__option-flag">{country.flag}</span>
                    <span className="phone-input__option-name">{country.name}</span>
                    <span className="phone-input__option-code">{country.code}</span>
                  </button>
                )
              })
            ) : (
              <div className="phone-input__empty">
                No se encontraron países
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="phone-input__error">{error}</p>}
    </div>
  )
}

export default PhoneInput
