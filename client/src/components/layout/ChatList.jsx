import { useState, useEffect, useRef, useCallback } from 'react'
import { Flame, Search, Plus, Settings, MessageCircle, User, X, Loader2, Trash2, Rocket, Phone } from 'lucide-react'
import useChatStore from '../../stores/chatStore'
import useAuthStore from '../../stores/authStore'
import './ChatList.css'

/**
 * ChatList — Panel izquierdo de conversaciones reales
 * Muestra las conversaciones del usuario con búsqueda de usuarios para iniciar DMs
 * Incluye tabs: Chats | Comunidades | Llamadas
 *
 * Props:
 *  - section (opcional): 'chats' | 'comunidades' — para mobile
 *  - onSelectConversation: callback cuando se selecciona una conversación
 */
function ChatList({ section, onSelectConversation, onOpenProfile }) {
  const [activeTab, setActiveTab] = useState('chats')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatQuery, setNewChatQuery] = useState('')
  const [isStartingDM, setIsStartingDM] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const searchTimeoutRef = useRef(null)
  const newChatInputRef = useRef(null)

  const {
    conversations,
    activeConversation,
    isLoadingConversations,
    typingUsers,
    searchUsers,
    startDM,
    setActiveConversation,
    unreadCounts,
    deleteConversation,
  } = useChatStore()

  const user = useAuthStore(state => state.user)

  // Focus en el input de nuevo chat cuando se abre
  useEffect(() => {
    if (showNewChat && newChatInputRef.current) {
      newChatInputRef.current.focus()
    }
  }, [showNewChat])

  // Buscar usuarios con debounce
  const handleUserSearch = useCallback((query) => {
    setNewChatQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (query.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchUsers(query)
      setSearchResults(results)
      setIsSearching(false)
    }, 400)
  }, [searchUsers])

  // Iniciar DM con un usuario encontrado
  const handleStartDM = async (targetUser) => {
    setIsStartingDM(true)
    try {
      const conversation = await startDM(targetUser.id)
      setShowNewChat(false)
      setNewChatQuery('')
      setSearchResults([])
      if (onSelectConversation) onSelectConversation(conversation)
    } catch (err) {
      console.error('Error al iniciar DM:', err)
    } finally {
      setIsStartingDM(false)
    }
  }

  // Seleccionar una conversación existente
  const handleSelectConversation = (conv) => {
    setActiveConversation(conv)
    if (onSelectConversation) onSelectConversation(conv)
  }

  const handleContextMenu = useCallback((e, conv) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX || e.touches?.[0]?.clientX || 0, y: e.clientY || e.touches?.[0]?.clientY || 0, conv })
  }, [])

  const longPressRef = useRef(null)
  const handleTouchStart = useCallback((conv) => {
    longPressRef.current = setTimeout(() => {
      setContextMenu({ x: window.innerWidth / 2, y: window.innerHeight / 2, conv })
    }, 500)
  }, [])
  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current)
  }, [])

  const handleDeleteConversation = useCallback(async () => {
    if (!contextMenu) return
    const confirmed = window.confirm('¿Eliminar esta conversación? Se borrarán todos los mensajes.')
    if (confirmed) {
      await deleteConversation(contextMenu.conv.id)
    }
    setContextMenu(null)
  }, [contextMenu, deleteConversation])

  // Filtrar conversaciones por búsqueda local
  const filteredConversations = (conversations || []).filter(conv => {
    if (!searchQuery) return true
    const otherName = getConversationName(conv, user)
    return otherName.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Formatear la hora relativa
  const formatTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Ahora'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays === 1) return 'Ayer'
    if (diffDays < 7) {
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      return days[date.getDay()]
    }
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="chat-list">
      {/* Premium Header with branding */}
      <div className="chat-list__header">
        <div className="chat-list__logo">
          <Flame size={22} className="chat-list__logo-icon" />
          <span className="chat-list__logo-text">Fénix Chat</span>
          <span className="chat-list__logo-fire">🔥</span>
        </div>
        <button
          className="chat-list__new-btn"
          aria-label="Nueva conversación"
          onClick={() => setShowNewChat(!showNewChat)}
        >
          {showNewChat ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {/* Sub-tabs: Chats | Comunidades | Llamadas */}
      <div className="chat-list__tabs">
        <button
          className={`chat-list__tab ${activeTab === 'chats' ? 'chat-list__tab--active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          Chats
        </button>
        <button
          className={`chat-list__tab ${activeTab === 'comunidades' ? 'chat-list__tab--active' : ''}`}
          onClick={() => setActiveTab('comunidades')}
        >
          Comunidades
        </button>
        <button
          className={`chat-list__tab ${activeTab === 'llamadas' ? 'chat-list__tab--active' : ''}`}
          onClick={() => setActiveTab('llamadas')}
        >
          Llamadas
        </button>
      </div>

      {/* === CHATS TAB === */}
      {activeTab === 'chats' && (
        <>
          {/* Panel de nueva conversación — búsqueda de usuarios */}
          {showNewChat && (
            <div className="chat-list__new-chat-panel">
              <div className="chat-list__new-chat-search">
                <Search size={16} className="chat-list__search-icon" />
                <input
                  ref={newChatInputRef}
                  type="text"
                  className="chat-list__search-input"
                  placeholder="Buscar usuario por nombre..."
                  value={newChatQuery}
                  onChange={(e) => handleUserSearch(e.target.value)}
                />
              </div>

              <div className="chat-list__new-chat-results">
                {isSearching && (
                  <div className="chat-list__search-status">
                    <Loader2 size={16} className="chat-list__spinner" />
                    <span>Buscando...</span>
                  </div>
                )}

                {!isSearching && newChatQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="chat-list__search-status">
                    <span>No se encontraron usuarios</span>
                  </div>
                )}

                {searchResults.map((foundUser) => (
                  <button
                    key={foundUser.id}
                    className="chat-list__search-result"
                    onClick={() => handleStartDM(foundUser)}
                    disabled={isStartingDM}
                  >
                    <div className="chat-list__avatar chat-list__avatar--small">
                      {foundUser.avatar_url ? (
                        <img src={foundUser.avatar_url} alt={foundUser.username} className="chat-list__avatar-img" />
                      ) : (
                        getInitials(foundUser.username)
                      )}
                    </div>
                    <div className="chat-list__search-result-info">
                      <span className="chat-list__search-result-name">{foundUser.username}</span>
                      {foundUser.display_name && (
                        <span className="chat-list__search-result-display">{foundUser.display_name}</span>
                      )}
                    </div>
                    <MessageCircle size={16} className="chat-list__search-result-icon" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Barra de búsqueda de conversaciones */}
          <div className="chat-list__search">
            <div className="chat-list__search-bar">
              <Search size={16} className="chat-list__search-icon" />
              <input
                type="text"
                className="chat-list__search-input"
                placeholder="Buscar conversación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Lista de conversaciones */}
          <div className="chat-list__items">
            {isLoadingConversations && conversations.length === 0 ? (
              // Skeleton loading
              <div className="chat-list__loading">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="chat-list__skeleton-item">
                    <div className="chat-list__skeleton-avatar skeleton" />
                    <div className="chat-list__skeleton-content">
                      <div className="chat-list__skeleton-name skeleton" />
                      <div className="chat-list__skeleton-message skeleton" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="chat-list__empty">
                <MessageCircle size={40} className="chat-list__empty-icon" />
                <p className="chat-list__empty-text">
                  {searchQuery ? 'No se encontraron conversaciones' : 'Aún no tienes conversaciones'}
                </p>
                {!searchQuery && (
                  <p className="chat-list__empty-hint">
                    Toca <Plus size={14} style={{ verticalAlign: 'middle' }} /> para iniciar un chat
                  </p>
                )}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = activeConversation?.id === conv.id
                const otherName = getConversationName(conv, user)
                const otherAvatar = getConversationAvatar(conv, user)
                const isTyping = typingUsers[conv.id]
                const unreadCount = unreadCounts[conv.id] || 0
                const hasUnread = unreadCount > 0

                const itemClasses = [
                  'chat-list__item',
                  isActive && 'chat-list__item--active',
                  hasUnread && 'chat-list__item--unread',
                ].filter(Boolean).join(' ')

                return (
                  <div key={conv.id} className="chat-list__item-wrapper">
                    <div
                      className={itemClasses}
                      onClick={() => handleSelectConversation(conv)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectConversation(conv)}
                      onContextMenu={(e) => handleContextMenu(e, conv)}
                      onTouchStart={() => handleTouchStart(conv)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchEnd}
                    >
                      {/* Avatar */}
                      <div className={`chat-list__avatar ${isTyping ? 'chat-list__avatar--typing' : ''}`}>
                        {otherAvatar ? (
                          <img src={otherAvatar} alt={otherName} className="chat-list__avatar-img" />
                        ) : (
                          getInitials(otherName)
                        )}
                        {/* Estado online — TODO: implementar presencia real */}
                      </div>

                      {/* Contenido */}
                      <div className="chat-list__item-content">
                        <div className="chat-list__item-top">
                          <span className="chat-list__item-name">{otherName}</span>
                          <span className="chat-list__item-time">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <div className="chat-list__item-bottom">
                          {isTyping ? (
                            <span className="chat-list__item-typing">
                              escribiendo
                              <span className="chat-list__typing-dots">
                                <span>.</span><span>.</span><span>.</span>
                              </span>
                            </span>
                          ) : (
                            <span className="chat-list__item-preview">
                              {conv.last_sender && conv.last_sender !== otherName
                                ? `Tú: ${conv.last_message || ''}`
                                : conv.last_message || 'Conversación nueva'
                              }
                            </span>
                          )}
                          {hasUnread && (
                            <span className="chat-list__unread-badge">
                              🔥 {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* === COMUNIDADES TAB === */}
      {activeTab === 'comunidades' && (
        <div className="chat-list__placeholder">
          <div className="chat-list__placeholder-icon">
            <Rocket size={48} />
          </div>
          <h3 className="chat-list__placeholder-title">Próximamente</h3>
          <p className="chat-list__placeholder-desc">
            Las comunidades están en camino. Pronto podrás crear y unirte a comunidades gaming, organizar torneos y mucho más.
          </p>
          <div className="chat-list__placeholder-badge">
            🚀 En desarrollo
          </div>
        </div>
      )}

      {/* === LLAMADAS TAB === */}
      {activeTab === 'llamadas' && (
        <div className="chat-list__placeholder">
          <div className="chat-list__placeholder-icon">
            <Phone size={48} />
          </div>
          <h3 className="chat-list__placeholder-title">Historial de llamadas</h3>
          <p className="chat-list__placeholder-desc">
            Historial de llamadas próximamente. Podrás ver todas tus llamadas de voz y video realizadas y recibidas.
          </p>
          <div className="chat-list__placeholder-badge">
            📞 Próximamente
          </div>
        </div>
      )}

      {/* Barra de usuario (abajo) — solo en modo desktop */}
      {!section && user && (
        <div className="chat-list__user-bar">
          <div className="chat-list__user-avatar">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="chat-list__avatar-img" />
            ) : (
              getInitials(user.username)
            )}
            <span className="chat-list__user-online-dot" />
          </div>
          <div className="chat-list__user-info">
            <div className="chat-list__user-name">{user.username}</div>
            <div className="chat-list__user-status">En línea</div>
          </div>
          <button className="chat-list__settings-btn" aria-label="Configuración" onClick={onOpenProfile}>
            <Settings size={18} />
          </button>
        </div>
      )}

      {contextMenu && (
        <>
          <div className="chat-list__context-overlay" onClick={() => setContextMenu(null)} />
          <div className="chat-list__context-menu" style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 200) }}>
            <button className="chat-list__context-item chat-list__context-item--danger" onClick={handleDeleteConversation}>
              <Trash2 size={16} />
              <span>Eliminar conversación</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// --- Utilidades ---

/** Obtener nombre de la conversación (el otro participante) */
function getConversationName(conversation, currentUser) {
  if (conversation.name) return conversation.name
  if (conversation.participants) {
    const other = conversation.participants.find(p => p.id !== currentUser?.id)
    return other?.username || other?.display_name || 'Usuario'
  }
  return conversation.other_username || 'Conversación'
}

/** Obtener avatar de la conversación */
function getConversationAvatar(conversation, currentUser) {
  if (conversation.participants) {
    const other = conversation.participants.find(p => p.id !== currentUser?.id)
    return other?.avatar_url || null
  }
  return conversation.other_avatar_url || null
}

/** Obtener iniciales de un nombre */
function getInitials(name) {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

export default ChatList
