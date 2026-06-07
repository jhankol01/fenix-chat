import { useState, useEffect } from 'react'
import PhoenixIcon from '../components/ui/PhoenixIcon'
import ChatList from '../components/layout/ChatList'
import ChatView from '../components/layout/ChatView'
import ProfileView from '../components/layout/ProfileView'
import OnlineUsers from '../components/layout/OnlineUsers'
import ContactsView from '../components/layout/ContactsView'
import CallOverlay from '../components/layout/CallOverlay'
import BottomNav from '../components/layout/BottomNav'
import useAuthStore from '../stores/authStore'
import useChatStore from '../stores/chatStore'
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket'
import { requestNotificationPermission, notifyNewMessage } from '../lib/notifications'
import api from '../lib/api'
import './AppLayout.css'

// Only this email sees the online-users panel
const ADMIN_EMAIL = 'jhanamazon1729@gmail.com'

// Color theme definitions (must stay in sync with ProfileView)
const THEMES = {
  fenix:   { brand: '#7C3AED', light: '#A855F7', dark: '#6D28D9' },
  ocean:   { brand: '#0ea5e9', light: '#38bdf8', dark: '#0284c7' },
  emerald: { brand: '#10b981', light: '#34d399', dark: '#059669' },
  rose:    { brand: '#f43f5e', light: '#fb7185', dark: '#e11d48' },
  amber:   { brand: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
}

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
  const [showDesktopProfile, setShowDesktopProfile] = useState(false)
  const isMobile = useIsMobile()

  const accessToken = useAuthStore(state => state.accessToken)
  const currentUser = useAuthStore(state => state.user)
  const { activeConversation, loadConversations, addMessage, setUserTyping, clearTyping } = useChatStore()

  // Fetch preferences on mount and apply color theme
  useEffect(() => {
    api.get('/preferences').then(data => {
      const themeKey = data?.preferences?.theme || 'fenix'
      const t = THEMES[themeKey] || THEMES.fenix
      document.documentElement.style.setProperty('--color-brand', t.brand)
      document.documentElement.style.setProperty('--color-brand-light', t.light)
      document.documentElement.style.setProperty('--color-brand-dark', t.dark)
    }).catch(() => {})
  }, [])

  // Conectar socket y configurar event listeners
  useEffect(() => {
    if (!accessToken) return

    // Solicitar permiso para notificaciones
    requestNotificationPermission()

    // Conectar socket con el token de autenticación
    const socket = connectSocket(accessToken)

    // Escuchar nuevos mensajes
    socket.on('new_message', (message) => {
      addMessage(message)

      // Notificar si el mensaje NO es del usuario actual
      if (message.sender_id !== currentUser?.id) {
        const activeId = useChatStore.getState().activeConversation?.id
        notifyNewMessage({
          senderName: message.sender_username || 'Nuevo mensaje',
          content: message.content,
          conversationId: message.conversation_id,
          activeConversationId: activeId,
        })
      }
    })

    // Group created — reload conversations
    socket.on('group_created', () => {
      loadConversations()
    })

    // Escuchar indicadores de escritura
    socket.on('user_typing', ({ conversationId, username }) => {
      setUserTyping(conversationId, username)
    })

    socket.on('user_stop_typing', ({ conversationId }) => {
      clearTyping(conversationId)
    })

    // Presence: online users
    const { setOnlineUsers, addOnlineUser, removeOnlineUser } = useChatStore.getState()
    socket.on('online_users', (userIds) => setOnlineUsers(userIds))
    socket.on('user_online', ({ userId }) => addOnlineUser(userId))
    socket.on('user_offline', ({ userId }) => removeOnlineUser(userId))

    // Cargar conversaciones al montar
    loadConversations()

    // Limpiar al desmontar
    return () => {
      socket.off('new_message')
      socket.off('user_typing')
      socket.off('user_stop_typing')
      socket.off('online_users')
      socket.off('user_online')
      socket.off('user_offline')
      disconnectSocket()
    }
  }, [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Cuando se selecciona una conversación (desde ChatList) */
  const handleSelectConversation = () => {
    setShowDesktopProfile(false)
    if (isMobile) {
      setShowMobileChat(true)
    }
  }

  /** Abrir perfil (desktop) */
  const handleOpenProfile = () => {
    setShowDesktopProfile(true)
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
      <>
      <CallOverlay />
      <div className="app-layout">
        {/* Panel izquierdo — Lista de conversaciones */}
        <div className="app-layout__sidebar">
          <ChatList
            onSelectConversation={handleSelectConversation}
            onOpenProfile={handleOpenProfile}
          />
        </div>

        {/* Panel principal — Chat, Profile o Welcome */}
        <div className="app-layout__main">
          {showDesktopProfile ? (
            <ProfileView />
          ) : activeConversation ? (
            <ChatView />
          ) : (
            <div className="welcome-screen">
              <div className="welcome-screen__icon">
                <PhoenixIcon size={56} variant="fire" glow />
              </div>
              <h1 className="welcome-screen__title">Fénix Chat</h1>
              <p className="welcome-screen__subtitle">
                Selecciona una conversación para comenzar a chatear
              </p>
            </div>
          )}
        </div>
      </div>
      </>
    )
  }

  /* ============================
     MOBILE LAYOUT (< 768px)
     ============================ */
  return (
    <>
    <CallOverlay />
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
          currentUser?.email === ADMIN_EMAIL ? (
            <OnlineUsers onSelectConversation={handleSelectConversation} />
          ) : (
            <ContactsView onSelectConversation={handleSelectConversation} />
          )
        )}
        {mobileSection === 'fenix' && (
          <div className="section-placeholder section-placeholder--fenix">
            <div className="section-placeholder__icon section-placeholder__icon--fire">🔥</div>
            <h2 className="section-placeholder__title">Fénix Hub</h2>
            <p className="section-placeholder__desc">
              Tu centro de actividad. Descubre comunidades, eventos y contenido exclusivo.
            </p>
            <div className="section-placeholder__cards">
              <div className="section-placeholder__card">
                <span>🎙️</span>
                <span>Salas de Voz</span>
              </div>
              <div className="section-placeholder__card">
                <span>📅</span>
                <span>Eventos</span>
              </div>
              <div className="section-placeholder__card">
                <span>⭐</span>
                <span>Destacados</span>
              </div>
            </div>
            <span className="section-placeholder__badge">✨ En desarrollo</span>
          </div>
        )}
        {mobileSection === 'notificaciones' && (
          <div className="section-placeholder">
            <div className="section-placeholder__icon">🔔</div>
            <h2 className="section-placeholder__title">Notificaciones</h2>
            <p className="section-placeholder__desc">
              Aquí verás tus alertas, menciones y actividad reciente.
            </p>
            <span className="section-placeholder__badge">🔜 Próximamente</span>
          </div>
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
    </>
  )
}

export default AppLayout
