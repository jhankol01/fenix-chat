import { useState, useEffect } from 'react'
import { Flame } from 'lucide-react'
import ChatList from '../components/layout/ChatList'
import ChatView from '../components/layout/ChatView'
import BottomNav from '../components/layout/BottomNav'
import ProfileView from '../components/layout/ProfileView'
import './AppLayout.css'

/**
 * Hook para detectar si estamos en pantalla móvil
 */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isMobile
}

/**
 * AppLayout — Shell principal con diseño adaptativo
 *
 * Desktop (>= 768px): ChatList (340px, con tabs internos) | ChatView/Welcome
 * Mobile  (< 768px):  BottomNav + contenido dinámico por sección
 */
function AppLayout() {
  const [activeItemId, setActiveItemId] = useState(null)
  const [activeItemType, setActiveItemType] = useState(null)       // 'chats' o 'comunidades'
  const [mobileSection, setMobileSection] = useState('chats')      // Sección activa del BottomNav
  const isMobile = useIsMobile()

  /** Seleccionar un item (comunidad o DM) */
  const handleSelectItem = (id, section) => {
    setActiveItemId(id)
    setActiveItemType(section)
  }

  /** Volver a la lista (mobile) */
  const handleBack = () => {
    setActiveItemId(null)
  }

  /** Cambiar sección del BottomNav (mobile) */
  const handleSectionChange = (section) => {
    setMobileSection(section)
    // Limpiar item activo al cambiar de sección
    setActiveItemId(null)
  }

  /* ============================
     DESKTOP LAYOUT (>= 768px)
     ============================ */
  if (!isMobile) {
    return (
      <div className="app-layout">
        {/* Panel izquierdo — Lista con tabs internos */}
        <div className="app-layout__sidebar">
          <ChatList
            activeItemId={activeItemId}
            onSelectItem={handleSelectItem}
          />
        </div>

        {/* Panel principal — Chat o Welcome */}
        <div className="app-layout__main">
          {activeItemId ? (
            <ChatView
              itemId={activeItemId}
              itemType={activeItemType}
              onBack={handleBack}
            />
          ) : (
            <div className="welcome-screen">
              <div className="welcome-screen__icon">
                <Flame size={56} />
              </div>
              <h1 className="welcome-screen__title">Fénix Chat</h1>
              <p className="welcome-screen__subtitle">
                Selecciona un chat o comunidad para comenzar
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ============================
     MOBILE LAYOUT (< 768px)
     ============================ */

  // Si hay un item activo, mostrar ChatView a pantalla completa
  const showChatView = !!activeItemId

  return (
    <div className="app-layout app-layout--mobile">
      {/* Contenido principal basado en la sección activa */}
      <div className={`app-layout__mobile-content ${showChatView ? 'app-layout__mobile-content--hidden' : ''}`}>
        {mobileSection === 'chats' && (
          <ChatList
            activeItemId={activeItemId}
            onSelectItem={handleSelectItem}
            section="chats"
          />
        )}
        {mobileSection === 'comunidades' && (
          <ChatList
            activeItemId={activeItemId}
            onSelectItem={handleSelectItem}
            section="comunidades"
          />
        )}
        {mobileSection === 'perfil' && (
          <ProfileView />
        )}
      </div>

      {/* ChatView a pantalla completa cuando hay item activo */}
      {showChatView && (
        <div className="app-layout__mobile-chat">
          <ChatView
            itemId={activeItemId}
            itemType={activeItemType}
            onBack={handleBack}
          />
        </div>
      )}

      {/* Barra de navegación inferior */}
      <BottomNav
        activeSection={mobileSection}
        onSectionChange={handleSectionChange}
      />
    </div>
  )
}

export default AppLayout
