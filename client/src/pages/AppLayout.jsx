import { useState, useEffect } from 'react'
import PhoenixIcon from '../components/ui/PhoenixIcon'
import ChatList from '../components/layout/ChatList'
import ChatView from '../components/layout/ChatView'
import ProfileView from '../components/layout/ProfileView'
import OnlineUsers from '../components/layout/OnlineUsers'
import ContactsView from '../components/layout/ContactsView'
import CommunitiesView from '../components/layout/CommunitiesView'
import CommunityDetail from '../components/layout/CommunityDetail'
import CallOverlay from '../components/layout/CallOverlay'
import BottomNav from '../components/layout/BottomNav'
import StoriesBar from '../components/layout/StoriesBar'
import useAuthStore from '../stores/authStore'
import useChatStore from '../stores/chatStore'
import { connectSocket, disconnectSocket, getSocket, onReconnect } from '../lib/socket'
import { requestNotificationPermission, notifyNewMessage, initPushNotifications } from '../lib/notifications'
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
  const [selectedCommunity, setSelectedCommunity] = useState(null)
  const isMobile = useIsMobile()

  const accessToken = useAuthStore(state => state.accessToken)
  const currentUser = useAuthStore(state => state.user)
  const { activeConversation, conversations, unreadCounts, loadConversations, addMessage, setUserTyping, clearTyping, setActiveConversation } = useChatStore()

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

    // Solicitar permiso para notificaciones + registrar push
    requestNotificationPermission()
    initPushNotifications()

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

    // Recargar datos cuando el socket reconecta o la pestaña vuelve
    onReconnect(() => {
      console.log('🔄 Reconnected — reloading data...')
      loadConversations()
      // Recargar mensajes de la conversación activa
      const activeConv = useChatStore.getState().activeConversation
      if (activeConv?.id) {
        useChatStore.getState().loadMessages(activeConv.id)
      }
    })

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
  const [desktopSection, setDesktopSection] = useState('chats')

  if (!isMobile) {
    return (
      <>
      <CallOverlay />
      <div className="app-layout">
        {/* ─── Navigation Rail ─── */}
        <div className="app-layout__rail">
          <div className="app-layout__rail-logo">
            <PhoenixIcon size={28} />
          </div>
          <button
            className={`app-layout__rail-btn ${desktopSection === 'chats' ? 'app-layout__rail-btn--active' : ''}`}
            onClick={() => { setDesktopSection('chats'); setShowDesktopProfile(false) }}
            title="Chats"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span>Chats</span>
          </button>
          <button
            className={`app-layout__rail-btn ${desktopSection === 'comunidades' ? 'app-layout__rail-btn--active' : ''}`}
            onClick={() => { setDesktopSection('comunidades'); setShowDesktopProfile(false) }}
            title="Comunidades"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            <span>Comunidades</span>
          </button>
          {currentUser?.email === ADMIN_EMAIL && (
            <button
              className={`app-layout__rail-btn ${desktopSection === 'admin' ? 'app-layout__rail-btn--active' : ''}`}
              onClick={() => { setDesktopSection('admin'); setShowDesktopProfile(false) }}
              title="Admin"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              <span>Admin</span>
            </button>
          )}
          <div className="app-layout__rail-spacer" />
          <button
            className={`app-layout__rail-btn ${desktopSection === 'perfil' ? 'app-layout__rail-btn--active' : ''}`}
            onClick={() => { setDesktopSection('perfil'); setShowDesktopProfile(true) }}
            title="Perfil"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Perfil</span>
          </button>
        </div>

        {/* ─── Sidebar (list panel) ─── */}
        <div className="app-layout__sidebar">
          {desktopSection === 'chats' && (
            <ChatList
              onSelectConversation={handleSelectConversation}
              onOpenProfile={handleOpenProfile}
            />
          )}
          {desktopSection === 'comunidades' && (
            <CommunitiesView onOpenCommunity={(c) => {
              setSelectedCommunity(c)
            }} />
          )}
          {desktopSection === 'admin' && (
            <OnlineUsers onSelectConversation={handleSelectConversation} />
          )}
          {desktopSection === 'perfil' && (
            <ProfileView />
          )}
        </div>

        {/* ─── Main panel ─── */}
        <div className="app-layout__main">
          {desktopSection === 'comunidades' && selectedCommunity ? (
            <CommunityDetail
              community={selectedCommunity}
              onBack={() => setSelectedCommunity(null)}
            />
          ) : showDesktopProfile ? (
            <ProfileView />
          ) : activeConversation ? (
            <ChatView />
          ) : (
            <div className="welcome-screen">
              <div className="welcome-screen__icon">
                <PhoenixIcon size={56} variant="fire" glow />
              </div>
              <h1 className="welcome-screen__title">Fenix Messenger</h1>
              <p className="welcome-screen__subtitle">
                {desktopSection === 'comunidades'
                  ? 'Selecciona una comunidad para ver sus canales'
                  : 'Selecciona una conversación para comenzar a chatear'}
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
    <div className={`app-layout app-layout--mobile${showMobileChat ? ' app-layout--chat-open' : ''}`}>
      {/* Contenido principal basado en la sección activa */}
      <div className={`app-layout__mobile-content ${showMobileChat ? 'app-layout__mobile-content--hidden' : ''}`}>
        {mobileSection === 'chats' && (
          <ChatList
            section="chats"
            onSelectConversation={handleSelectConversation}
          />
        )}
        {mobileSection === 'comunidades' && (
          <CommunitiesView onOpenCommunity={(c) => {
            setSelectedCommunity(c)
            setMobileSection('community-detail')
          }} />
        )}
        {mobileSection === 'community-detail' && selectedCommunity && (
          <CommunityDetail
            community={selectedCommunity}
            onBack={() => {
              setSelectedCommunity(null)
              setMobileSection('comunidades')
            }}
          />
        )}
        {mobileSection === 'fenix' && (
          <div className="fenix-hub">
            <StoriesBar autoOpen />
            <div className="section-placeholder__cards" style={{ padding: '12px 16px' }}>
              <div className="section-placeholder__card" onClick={() => {
                setMobileSection('chats')
              }}>
                <span>💬</span>
                <span>Chats</span>
              </div>
              <div className="section-placeholder__card" onClick={() => {
                setMobileSection('contactos')
              }}>
                <span>👥</span>
                <span>Contactos</span>
              </div>
              <div className="section-placeholder__card" onClick={() => {
                setMobileSection('perfil')
              }}>
                <span>🎨</span>
                <span>Personalizar</span>
              </div>
            </div>
          </div>
        )}
        {mobileSection === 'notificaciones' && (
          <div className="section-placeholder">
            <div className="section-placeholder__icon">🔔</div>
            <h2 className="section-placeholder__title">Notificaciones</h2>
            {Object.keys(unreadCounts).length > 0 ? (
              <div className="section-placeholder__notif-list">
                {conversations.filter(c => unreadCounts[c.id] > 0).map(c => (
                  <button key={c.id} className="section-placeholder__notif-item" onClick={() => {
                    setActiveConversation(c)
                    setMobileSection('chats')
                    setShowMobileChat(true)
                  }}>
                    <span className="section-placeholder__notif-badge">{unreadCounts[c.id]}</span>
                    <span>{c.other_username || c.name || 'Chat'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="section-placeholder__desc">No hay notificaciones pendientes 🎉</p>
            )}
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

      {/* Barra de navegación inferior (oculta dentro del chat) */}
      {!showMobileChat && (
        <BottomNav
          activeSection={mobileSection}
          onSectionChange={handleSectionChange}
        />
      )}
    </div>
    </>
  )
}

export default AppLayout
