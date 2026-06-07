import { Home, Users, Bell, User } from 'lucide-react'
import PhoenixIcon from '../ui/PhoenixIcon'
import './BottomNav.css'

/**
 * BottomNav — Navegación inferior con íconos lineales + fénix central
 * Estilo limpio como el concepto mockup
 */
function BottomNav({ activeSection, onSectionChange }) {
  const tabs = [
    { id: 'chats', label: 'Inicio', Icon: Home },
    { id: 'comunidades', label: 'Comunidades', Icon: Users },
    { id: 'fenix', label: '', Icon: null, isCenter: true },
    { id: 'notificaciones', label: 'Notificaciones', Icon: Bell },
    { id: 'perfil', label: 'Perfil', Icon: User },
  ]

  return (
    <nav className="bottom-nav" role="tablist" aria-label="Navegación principal">
      {tabs.map((tab) => {
        const isActive = activeSection === tab.id
        
        if (tab.isCenter) {
          return (
            <button
              key={tab.id}
              className="bottom-nav__center"
              onClick={() => onSectionChange(tab.id)}
              aria-label="Fénix"
            >
              <div className="bottom-nav__center-ring">
                <PhoenixIcon size={32} />
              </div>
            </button>
          )
        }

        return (
          <button
            key={tab.id}
            className={`bottom-nav__tab ${isActive ? 'bottom-nav__tab--active' : ''}`}
            onClick={() => onSectionChange(tab.id)}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
          >
            <span className="bottom-nav__icon">
              <tab.Icon size={20} strokeWidth={isActive ? 2.2 : 1.5} />
            </span>
            <span className="bottom-nav__label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNav
