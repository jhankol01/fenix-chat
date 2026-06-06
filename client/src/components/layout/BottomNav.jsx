import { MessageCircle, Users, User } from 'lucide-react'
import './BottomNav.css'

/**
 * BottomNav — Navegación inferior para mobile
 * 3 secciones: Chats, Comunidades, Yo (Perfil)
 * Se oculta automáticamente en desktop (>= 768px via CSS)
 */
function BottomNav({ activeSection, onSectionChange }) {
  const tabs = [
    { id: 'chats', label: 'Chats', icon: MessageCircle },
    { id: 'comunidades', label: 'Comunidades', icon: Users },
    { id: 'perfil', label: 'Yo', icon: User },
  ]

  return (
    <nav className="bottom-nav" role="tablist" aria-label="Navegación principal">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeSection === tab.id
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
