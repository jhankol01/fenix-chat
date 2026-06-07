import PhoenixIcon from '../ui/PhoenixIcon'
import './BottomNav.css'

/**
 * BottomNav — Navegación inferior premium con íconos Fénix Brand Pack
 * 5 tabs: Inicio(Chats), Comunidades, 🔥Fénix, Alertas(Voz), Perfil(Eventos)
 */
function BottomNav({ activeSection, onSectionChange }) {
  const tabs = [
    { id: 'chats', label: 'Inicio', icon: '/icons/Chats.png' },
    { id: 'comunidades', label: 'Comunidades', icon: '/icons/Comunidades.png' },
    { id: 'fenix', label: '', icon: null, isCenter: true },
    { id: 'notificaciones', label: 'Alertas', icon: '/icons/Anuncios.png' },
    { id: 'perfil', label: 'Perfil', icon: '/icons/Voz.png' },
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
                <PhoenixIcon size={26} variant="logo" glow />
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
              <img src={tab.icon} alt={tab.label} className="bottom-nav__icon-img" />
            </span>
            <span className="bottom-nav__label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNav
