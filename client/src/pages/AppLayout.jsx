import { useState, useEffect } from 'react'
import { Flame } from 'lucide-react'
import ChatList from '../components/layout/ChatList'
import ChatView from '../components/layout/ChatView'
import BottomNav from '../components/layout/BottomNav'
import ProfileView from '../components/layout/ProfileView'
import useAuthStore from '../stores/authStore'
import useChatStore from '../stores/chatStore'
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket'
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
 * Conecta el socket, carga conversaciones, y escucha eventos en tiempo real
 *
 * Desktop (>= 768px): ChatList (340px) | ChatView/Welcome
 * Mobile  (< 768px):  BottomNav + contenido dinámico por sección
 */
function AppLayout() {
  const [mobileSection, setMobileSection] = useState('chats')
  const [showMobileChat, setShowMobileChat] = useState(false)
  const isMobile = useIsMobile()

  const accessToken = useAuthStore(state => state.accessToken)
  const { activeConversation, loadConversations, addMessage, setUserTyping, clearTyping } = useChatStore()

  // Conectar socket y configurar event listeners
  useEffect(() => {
    if (!accessToken) return

    // Conectar socket con el token de autenticación
    const socket = connectSocket(accessToken)

    // Escuchar nuevos mensajes
    socket.on('new_message', (message) => {
      addMessage(message)
    })

    // Escuchar indicadores de escritura
    socket.on('user_typing', ({ conversationId, username }) => {
      setUserTyping(conversationId, username)
    })

    socket.on('user_stop_typing', ({ conversationId }) => {
      clearTyping(conversationId)
    })

    // Cargar conversaciones al montar
    loadConversations()

    // Limpiar al desmontar
    return () => {
      socket.off('new_message')
      socket.off('user_typing')
      socket.off('user_stop_typing')
      disconnectSocket()
    }
  }, [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Cuando se selecciona una conversación (desde ChatList) */
  const handleSelectConversation = () => {
    if (isMobile) {
      setShowMobileChat(true)
    }
  }

  /** Volver a la lista (mobile) */
  const handleBack = () => {
    setShowMobileChat(false)
  }

  /** Cambiar sección del BottomNav (mobile) */
  const handleSectionChange = (section) => {
    setMobileSection(section)
    setShowMobileChat(false)
  }

  /* ============================
     DESKTOP LAYOUT (>= 768px)
     ============================ */
  if (!isMobile) {
    return (
      <div className="app-layout">
        {/* Panel izquierdo — Lista de conversaciones */}
        <div className="app-layout__sidebar">
          <ChatList
            onSelectConversation={handleSelectConversation}
          />
        </div>

        {/* Panel principal — Chat o Welcome */}
        <div className="app-layout__main">
          {activeConversation ? (
            <ChatView />
          ) : (
            <div className="welcome-screen">
              <div className="welcome-screen__icon">
                <Flame size={56} />
              </div>
              <h1 className="welcome-screen__title">Fénix Chat</h1>
              <p className="welcome-screen__subtitle">
                Selecciona una conversación para comenzar a chatear
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
  return (
    <div className="app-layout app-layout--mobile">
      {/* Contenido principal basado en la sección activa */}
      <div className={`app-layout__mobile-content ${showMobileChat ? 'app-layout__mobile-content--hidden' : ''}`}>
        {mobileSection === 'chats' && (
          <ChatList
            section="chats"
            onSelectConversation={handleSelectConversation}
          />
        )}
        {mobileSection === 'comunidades' && (
          <ChatList
            section="comunidades"
            onSelectConversation={handleSelectConversation}
          />
        )}
        {mobileSection === 'perfil' && (
          <ProfileView />
        )}
      </div>

      {/* ChatView a pantalla completa cuando hay conversación activa */}
      {showMobileChat && activeConversation && (
        <div className="app-layout__mobile-chat">
          <ChatView onBack={handleBack} />
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
