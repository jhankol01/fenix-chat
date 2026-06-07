import { MessageCircle, Users, Bell, User } from 'lucide-react'
import PhoenixIcon from '../ui/PhoenixIcon'
import './BottomNav.css'

/**
 * BottomNav — Navegación inferior premium con fénix central
 * 5 tabs: Inicio, Comunidades, 🔥Fénix, Notificaciones, Perfil
 */
function BottomNav({ activeSection, onSectionChange }) {
  const tabs = [
    { id: 'chats', label: 'Inicio', icon: MessageCircle },
    { id: 'comunidades', label: 'Comunidades', icon: Users },
    { id: 'fenix', label: '', icon: null, isCenter: true },
    { id: 'notificaciones', label: 'Alertas', icon: Bell },
    { id: 'perfil', label: 'Perfil', icon: User },
  ]

  return (
    <nav className="bottom-nav" role="tablist" aria-label="Navegación principal">
      {tabs.map((tab) => {
        const Icon = tab.icon
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
              <PhoenixIcon size={26} variant="fire" glow />
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
              <Icon size={20} />
            </span>
            <span className="bottom-nav__label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNav
