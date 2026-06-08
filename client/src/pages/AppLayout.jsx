import { useState, useEffect } from 'react'
import PhoenixIcon from '../components/ui/PhoenixIcon'
import ChatList from '../components/layout/ChatList'
import ChatView from '../components/layout/ChatView'
import ProfileView from '../components/layout/ProfileView'
import OnlineUsers from '../components/layout/OnlineUsers'
import ContactsView from '../components/layout/ContactsView'
import CommunitiesView from '../components/layout/CommunitiesView'
import CommunityDetail from '../components/layout/CommunityDetail'
import CommunityDesktop from '../components/layout/CommunityDesktop'
import CallOverlay from '../components/layout/CallOverlay'
import BottomNav from '../components/layout/BottomNav'
import StoriesBar from '../components/layout/StoriesBar'
import VoiceIndicator from '../components/layout/VoiceIndicator'
import useAuthStore from '../stores/authStore'
import useChatStore from '../stores/chatStore'
import useVoiceStore from '../stores/voiceStore'
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
  const [myCommunities, setMyCommunities] = useState([])

  useEffect(() => {
    if (!isMobile) {
      api.get('/communities/mine').then(d => setMyCommunities(d.communities || [])).catch(() => {})
    }
  }, [isMobile])

  if (!isMobile) {
    const navItems = [
      { key: 'chats', icon: '💬', label: 'Chats' },
      { key: 'comunidades', icon: '🌐', label: 'Comunidades' },
      { key: 'contacts', icon: '👥', label: 'Amigos' },
      { key: 'notifications', icon: '🔔', label: 'Notificaciones' },
    ]

    return (
      <>
      <CallOverlay />
      <div className="app-layout">
        {/* ─── Left Sidebar Nav ─── */}
        <div className="app-layout__nav-sidebar">
          {/* Logo */}
          <div className="app-layout__nav-logo">
            <PhoenixIcon size={24} />
            <span>FÉNIX CHAT</span>
          </div>

          {/* User */}
          <div className="app-layout__nav-user">
            <div className="app-layout__nav-user-avatar">
              {currentUser?.avatar_url
                ? <img src={currentUser.avatar_url} alt="" />
                : <span>{(currentUser?.username || '??').slice(0,2).toUpperCase()}</span>}
              <div className="app-layout__nav-user-dot" />
            </div>
            <div className="app-layout__nav-user-info">
              <span>{currentUser?.display_name || currentUser?.username}</span>
              <small>En línea</small>
            </div>
          </div>

          {/* Nav Items */}
          <div className="app-layout__nav-items">
            {navItems.map(n => (
              <button key={n.key}
                className={`app-layout__nav-item ${desktopSection === n.key ? 'app-layout__nav-item--active' : ''}`}
                onClick={() => { setDesktopSection(n.key); setShowDesktopProfile(false); setSelectedCommunity(null) }}>
                <span className="app-layout__nav-item-icon">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
            {currentUser?.email === ADMIN_EMAIL && (
              <button className={`app-layout__nav-item ${desktopSection === 'admin' ? 'app-layout__nav-item--active' : ''}`}
                onClick={() => { setDesktopSection('admin'); setShowDesktopProfile(false) }}>
                <span className="app-layout__nav-item-icon">⚙️</span>
                <span>Admin</span>
              </button>
            )}
            <button className={`app-layout__nav-item ${desktopSection === 'perfil' ? 'app-layout__nav-item--active' : ''}`}
              onClick={() => { setDesktopSection('perfil'); setShowDesktopProfile(true) }}>
              <span className="app-layout__nav-item-icon">👤</span>
              <span>Ajustes</span>
            </button>
          </div>

          {/* My Communities */}
          <div className="app-layout__nav-section-title">Mis comunidades</div>
          <div className="app-layout__nav-communities">
            {myCommunities.map(c => (
              <button key={c.id}
                className={`app-layout__nav-community ${selectedCommunity?.id === c.id ? 'app-layout__nav-community--active' : ''}`}
                onClick={() => { setDesktopSection('comunidades'); setSelectedCommunity(c) }}>
                <div className="app-layout__nav-community-icon">
                  {c.icon_url ? <img src={c.icon_url} alt="" /> : <span>{c.name?.slice(0,1)}</span>}
                </div>
                <span>{c.name}</span>
              </button>
            ))}
            <button className="app-layout__nav-community app-layout__nav-community--add"
              onClick={() => { setDesktopSection('comunidades'); setSelectedCommunity(null) }}>
              <div className="app-layout__nav-community-icon app-layout__nav-community-icon--add">+</div>
              <span>Crear comunidad</span>
            </button>
          </div>

          {/* Voice Indicator in sidebar */}
          <VoiceIndicator onGoToVoice={() => {
            const vs = useVoiceStore.getState()
            if (vs.communityId) {
              // Find the community in myCommunities or use minimal object
              const c = myCommunities.find(c => c.id === vs.communityId) || { id: vs.communityId, name: vs.communityName }
              setSelectedCommunity(c)
              setDesktopSection('comunidades')
            }
          }} />
        </div>

        {/* ─── Main Area ─── */}
        <div className="app-layout__main-area">
          {/* CommunityDesktop stays mounted (hidden) so voice isn't killed on nav */}
          {selectedCommunity && (
            <div style={{ display: desktopSection === 'comunidades' ? 'contents' : 'none' }}>
              <CommunityDesktop
                community={selectedCommunity}
                onBack={() => setSelectedCommunity(null)}
              />
            </div>
          )}

          {desktopSection === 'comunidades' && !selectedCommunity && (
            <div className="app-layout__main-with-sidebar">
              <div className="app-layout__sidebar">
                <CommunitiesView onOpenCommunity={(c) => setSelectedCommunity(c)} />
              </div>
              <div className="app-layout__main">
                <div className="welcome-screen">
                  <div className="welcome-screen__icon"><PhoenixIcon size={56} variant="fire" glow /></div>
                  <h1 className="welcome-screen__title">Comunidades</h1>
                  <p className="welcome-screen__subtitle">Selecciona una comunidad para explorar</p>
                </div>
              </div>
            </div>
          )}

          {desktopSection === 'chats' && (
            <div className="app-layout__main-with-sidebar">
              <div className="app-layout__sidebar">
                <ChatList onSelectConversation={handleSelectConversation} onOpenProfile={handleOpenProfile} />
              </div>
              <div className="app-layout__main">
                {activeConversation ? <ChatView /> : (
                  <div className="welcome-screen">
                    <div className="welcome-screen__icon"><PhoenixIcon size={56} variant="fire" glow /></div>
                    <h1 className="welcome-screen__title">Fenix Messenger</h1>
                    <p className="welcome-screen__subtitle">Selecciona una conversación para comenzar a chatear</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {desktopSection === 'admin' && (
            <div className="app-layout__main-with-sidebar">
              <div className="app-layout__sidebar"><OnlineUsers onSelectConversation={handleSelectConversation} /></div>
              <div className="app-layout__main">{activeConversation ? <ChatView /> : <div className="welcome-screen"><h1 className="welcome-screen__title">Panel Admin</h1></div>}</div>
            </div>
          )}

          {desktopSection === 'contacts' && (
            <div className="app-layout__main-with-sidebar">
              <div className="app-layout__sidebar"><ContactsView onSelectConversation={handleSelectConversation} /></div>
              <div className="app-layout__main">{activeConversation ? <ChatView /> : <div className="welcome-screen"><h1 className="welcome-screen__title">Amigos</h1></div>}</div>
            </div>
          )}

          {desktopSection === 'perfil' && <ProfileView />}

          {desktopSection === 'notifications' && (
            <div className="welcome-screen">
              <div className="welcome-screen__icon"><PhoenixIcon size={56} variant="fire" glow /></div>
              <h1 className="welcome-screen__title">Notificaciones</h1>
              <p className="welcome-screen__subtitle">Próximamente</p>
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
        {/* Keep CommunityDetail mounted while voice is active */}
        {selectedCommunity && (
          <div style={{ display: mobileSection === 'community-detail' ? 'contents' : 'none' }}>
            <CommunityDetail
              community={selectedCommunity}
              onBack={() => {
                setSelectedCommunity(null)
                setMobileSection('comunidades')
              }}
            />
          </div>
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

      {/* Voice indicator floating above bottom nav */}
      {!showMobileChat && (
        <div className="voice-indicator--floating">
          <VoiceIndicator onGoToVoice={() => {
            const vs = useVoiceStore.getState()
            if (vs.communityId) {
              if (!selectedCommunity || selectedCommunity.id !== vs.communityId) {
                setSelectedCommunity({ id: vs.communityId, name: vs.communityName })
              }
              setMobileSection('community-detail')
            }
          }} />
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
