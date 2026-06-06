import { User, Bell, Lock, Settings, ChevronRight } from 'lucide-react'
import './ProfileView.css'

/**
 * ProfileView — Pantalla de perfil del usuario (tab "Yo")
 * Muestra avatar, nombre, estado, y opciones de menú
 */
function ProfileView() {
  const menuItems = [
    { id: 'profile', icon: User, label: 'Editar perfil' },
    { id: 'notifications', icon: Bell, label: 'Notificaciones' },
    { id: 'privacy', icon: Lock, label: 'Privacidad' },
    { id: 'settings', icon: Settings, label: 'Configuración' },
  ]

  return (
    <div className="profile-view">
      {/* Sección de usuario */}
      <div className="profile-view__user-section">
        <div className="profile-view__avatar">FU</div>
        <div className="profile-view__username">FenixUser</div>
        <div className="profile-view__status">
          <span className="profile-view__status-dot" />
          <span>En línea</span>
        </div>
      </div>

      {/* Divisor */}
      <hr className="profile-view__divider" />

      {/* Opciones de menú */}
      <div className="profile-view__menu">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className="profile-view__menu-item"
              aria-label={item.label}
            >
              <span className="profile-view__menu-icon">
                <Icon size={20} />
              </span>
              <span className="profile-view__menu-label">{item.label}</span>
              <span className="profile-view__menu-chevron">
                <ChevronRight size={18} />
              </span>
            </button>
          )
        })}
      </div>

      {/* Versión de la app */}
      <div className="profile-view__footer">
        <span className="profile-view__version">Fénix Chat v0.1.0</span>
      </div>
    </div>
  )
}

export default ProfileView
