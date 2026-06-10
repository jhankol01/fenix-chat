import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Plus, Settings, MessageCircle, User, X, Loader2, Trash2, Rocket, Phone, Users, Check, BellOff, Bell, Heart, Info, Ban, XCircle, Archive, Bot, CheckCheck, Camera } from 'lucide-react'
import PhoenixIcon from '../ui/PhoenixIcon'
import StoriesBar from './StoriesBar'
import useChatStore from '../../stores/chatStore'
import useAuthStore from '../../stores/authStore'
import api from '../../lib/api'
import './ChatList.css'

/**
 * SwipeableItem — Wrapper con gestos swipe para items del chat
 * Izquierda: muestra opciones del menú contextual
 * Derecha: muestra archivar + marcar como leído
 */
function SwipeableItem({ children, onSwipeLeft, onArchive, onMarkRead, hasUnread }) {
  const ref = useRef(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const swiping = useRef(false)
  const [offset, setOffset] = useState(0)
  const [direction, setDirection] = useState(null) // 'left' | 'right' | null

  const THRESHOLD = 70

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX
    currentX.current = startX.current
    swiping.current = true
  }

  const handleTouchMove = (e) => {
    if (!swiping.current) return
    currentX.current = e.touches[0].clientX
    const diff = currentX.current - startX.current

    // Limit max swipe distance
    const clamped = Math.max(-120, Math.min(120, diff))
    setOffset(clamped)

    if (Math.abs(diff) > 10) {
      setDirection(diff < 0 ? 'left' : 'right')
    }
  }

  const handleTouchEnd = () => {
    swiping.current = false
    const diff = currentX.current - startX.current

    if (diff < -THRESHOLD) {
      // Swiped left → show context menu options
      onSwipeLeft?.()
    } else if (diff > THRESHOLD) {
      // Swiped right → show archive/read actions — keep open briefly
      setOffset(120)
      setDirection('right')
      setTimeout(() => {
        setOffset(0)
        setDirection(null)
      }, 2000)
      return
    }

    setOffset(0)
    setDirection(null)
  }

  const handleAction = (action) => {
    action?.()
    setOffset(0)
    setDirection(null)
  }

  return (
    <div className="chat-list__swipeable-wrapper">
      {/* Right-side actions (revealed when swiping left) */}
      <div className="chat-list__swipe-actions chat-list__swipe-actions--left">
        <button className="chat-list__swipe-btn chat-list__swipe-btn--more" onClick={() => handleAction(onSwipeLeft)}>
          <Info size={20} />
          <span>Más</span>
        </button>
      </div>

      {/* Left-side actions (revealed when swiping right) */}
      <div className="chat-list__swipe-actions chat-list__swipe-actions--right">
        <button className="chat-list__swipe-btn chat-list__swipe-btn--archive" onClick={() => handleAction(onArchive)}>
          <Archive size={20} />
          <span>Archivar</span>
        </button>
        <button className="chat-list__swipe-btn chat-list__swipe-btn--read" onClick={() => handleAction(onMarkRead)}>
          <CheckCheck size={20} />
          <span>{hasUnread ? 'Leído' : 'No leído'}</span>
        </button>
      </div>

      {/* Swipeable content */}
      <div
        ref={ref}
        className="chat-list__swipeable-content"
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping.current ? 'none' : 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}

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
  // Muted conversations
  const [mutedConvs, setMutedConvs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fenix_muted_convs') || '[]') } catch { return [] }
  })
  // Favorites
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fenix_favorites') || '[]') } catch { return [] }
  })
  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fenix_blocked_users') || '[]') } catch { return [] }
  })

  const {
    conversations,
    activeConversation,
    isLoadingConversations,
    typingUsers,
    searchUsers,
    startDM,
    setActiveConversation,
    unreadCounts,
    onlineUsers,
    deleteConversation,
    createGroup,
  } = useChatStore()

  const user = useAuthStore(state => state.user)

  const toggleMuteConv = useCallback((convId) => {
    setMutedConvs(prev => {
      const updated = prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId]
      localStorage.setItem('fenix_muted_convs', JSON.stringify(updated))
      return updated
    })
  }, [])

  const toggleFavorite = useCallback((convId) => {
    setFavorites(prev => {
      const updated = prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId]
      localStorage.setItem('fenix_favorites', JSON.stringify(updated))
      return updated
    })
  }, [])

  const toggleBlockUser = useCallback((userId, userName) => {
    if (!userId) return
    setBlockedUsers(prev => {
      const isBlocked = prev.includes(userId)
      if (!isBlocked && !confirm(`¿Bloquear a ${userName}? Ya no podrá enviarte mensajes.`)) return prev
      const updated = isBlocked ? prev.filter(id => id !== userId) : [...prev, userId]
      localStorage.setItem('fenix_blocked_users', JSON.stringify(updated))
      return updated
    })
  }, [])

  const handleClearChat = useCallback(async () => {
    if (!contextMenu) return
    if (!confirm('¿Vaciar este chat? Se borrarán todos los mensajes.')) return
    try {
      await api.post(`/conversations/${contextMenu.conv.id}/clear`)
      // Clear messages in the store if this is the active conversation
      const store = useChatStore.getState()
      if (store.activeConversation?.id === contextMenu.conv.id) {
        useChatStore.setState({ messages: [] })
      }
    } catch (err) { console.error(err) }
    setContextMenu(null)
  }, [contextMenu])
  // Group creation state
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState([])
  const [groupSearch, setGroupSearch] = useState('')
  const [groupSearchResults, setGroupSearchResults] = useState([])
  const searchTimeoutRef = useRef(null)
  const newChatInputRef = useRef(null)

  // (store and user extracted above)

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

  // Start bot chat
  const [startingBot, setStartingBot] = useState(false)

  const startBotChat = async () => {
    setStartingBot(true)
    try {
      const data = await api.post('/bot/start')
      if (data.conversation) {
        handleSelectConversation(data.conversation)
      }
    } catch (err) {
      console.error('Error starting bot chat:', err)
    }
    setStartingBot(false)
  }

  // Group search
  const handleGroupSearch = async (q) => {
    setGroupSearch(q)
    if (!q.trim()) { setGroupSearchResults([]); return }
    try {
      const results = await searchUsers(q)
      setGroupSearchResults(results.filter(u => u.id !== user?.id && !groupMembers.find(m => m.id === u.id)))
    } catch (_) {}
  }

  const handleCreateGroup = () => {
    if (!groupName.trim() || groupMembers.length === 0) return
    createGroup(groupName.trim(), groupMembers.map(m => m.id))
    setShowCreateGroup(false)
    setGroupName('')
    setGroupMembers([])
    setGroupSearch('')
    setGroupSearchResults([])
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
          <PhoenixIcon size={36} />
          <div className="chat-list__logo-brand">
            <span className="chat-list__logo-fenix">FENIX</span>
            <span className="chat-list__logo-chat">MESSENGER</span>
          </div>
        </div>
        <button
          className="chat-list__new-btn chat-list__bot-btn"
          aria-label="Fenix IA"
          onClick={startBotChat}
          disabled={startingBot}
          title="Chatear con Fenix IA"
        >
          <Bot size={18} />
        </button>
        <button
          className="chat-list__new-btn"
          aria-label="Crear grupo"
          onClick={() => setShowCreateGroup(!showCreateGroup)}
        >
          <Users size={18} />
        </button>
        <button
          className="chat-list__new-btn"
          aria-label="Nueva conversación"
          onClick={() => setShowNewChat(!showNewChat)}
        >
          {showNewChat ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>


      {/* Panel de nueva conversación — búsqueda de usuarios */}
      {showNewChat && (
            <div className="chat-list__new-chat-panel">
              {/* Create group button */}
              <button
                className="chat-list__create-group-btn"
                onClick={() => { setShowCreateGroup(true); setShowNewChat(false) }}
              >
                <Users size={18} />
                <span>Crear grupo</span>
              </button>

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

      {/* Group creation modal */}
      {showCreateGroup && (
        <div className="chat-list__group-modal">
          <div className="chat-list__group-header">
            <button onClick={() => setShowCreateGroup(false)}><X size={18} /></button>
            <h3>Nuevo grupo</h3>
            <button
              className="chat-list__group-create-btn"
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || groupMembers.length === 0}
            >
              <Check size={18} />
            </button>
          </div>

          <input
            className="chat-list__group-name-input"
            placeholder="Nombre del grupo..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            autoFocus
          />

          {groupMembers.length > 0 && (
            <div className="chat-list__group-members-row">
              {groupMembers.map(m => (
                <div key={m.id} className="chat-list__group-member-chip">
                  <span>{m.username}</span>
                  <button onClick={() => setGroupMembers(prev => prev.filter(p => p.id !== m.id))}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="chat-list__new-chat-search">
            <Search size={16} className="chat-list__search-icon" />
            <input
              type="text"
              className="chat-list__search-input"
              placeholder="Buscar usuarios..."
              value={groupSearch}
              onChange={(e) => handleGroupSearch(e.target.value)}
            />
          </div>

          <div className="chat-list__new-chat-results">
            {groupSearchResults.map(u => (
              <button
                key={u.id}
                className="chat-list__search-result"
                onClick={() => {
                  setGroupMembers(prev => [...prev, u])
                  setGroupSearchResults(prev => prev.filter(p => p.id !== u.id))
                  setGroupSearch('')
                }}
              >
                <div className="chat-list__avatar chat-list__avatar--small">
                  {u.avatar_url ? <img src={u.avatar_url} alt={u.username} className="chat-list__avatar-img" /> : getInitials(u.username)}
                </div>
                <div className="chat-list__search-result-info">
                  <span className="chat-list__search-result-name">{u.username}</span>
                </div>
                <Plus size={16} className="chat-list__search-result-icon" />
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

          {/* Stories */}
          <StoriesBar />

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
                const otherId = conv.other_user_id
                const isOnline = otherId ? onlineUsers.has(otherId) : false

                const itemClasses = [
                  'chat-list__item',
                  isActive && 'chat-list__item--active',
                  hasUnread && 'chat-list__item--unread',
                ].filter(Boolean).join(' ')

                return (
                  <SwipeableItem
                    key={conv.id}
                    conv={conv}
                    onSwipeLeft={() => setContextMenu({ x: 0, y: 0, conv })}
                    onArchive={() => { /* future archive */ }}
                    onMarkRead={() => {
                      const store = useChatStore.getState()
                      if (store.markConversationRead) store.markConversationRead(conv.id)
                    }}
                    hasUnread={hasUnread}
                  >
                    <div
                      className={itemClasses}
                      onClick={() => handleSelectConversation(conv)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectConversation(conv)}
                      onContextMenu={(e) => handleContextMenu(e, conv)}
                    >
                      {/* Avatar */}
                      <div className={`chat-list__avatar ${isTyping ? 'chat-list__avatar--typing' : ''}`}>
                        {otherAvatar ? (
                          <img src={otherAvatar} alt={otherName} className="chat-list__avatar-img" />
                        ) : (
                          getInitials(otherName)
                        )}
                        {/* Online indicator dot */}
                        {isOnline && <span className="chat-list__online-dot" />}
                      </div>

                      {/* Contenido */}
                      <div className="chat-list__item-content">
                        <div className="chat-list__item-top">
                          <span className="chat-list__item-name">
                            {otherName}
                            {(otherName === 'Fenix IA' || otherName === 'fenix_ia') && (
                              <span className="chat-list__ai-badge">IA</span>
                            )}
                          </span>
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
                              {(() => {
                                const raw = conv.last_message_content || ''
                                const prefix = conv.last_message_sender && conv.last_message_sender !== otherName ? 'Tú: ' : ''
                                const content = formatPreview(raw)
                                return prefix + content || 'Conversación nueva'
                              })()}
                            </span>
                          )}
                          {mutedConvs.includes(conv.id) && (
                            <BellOff size={14} className="chat-list__muted-icon" />
                          )}
                          {hasUnread && !mutedConvs.includes(conv.id) && (
                            <span className="chat-list__unread-badge">
                              🔥 {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </SwipeableItem>
                )
              })
            )}
      </div>

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

      {/* WhatsApp-style Bottom Sheet */}
      {contextMenu && (() => {
        const conv = contextMenu.conv
        const sheetName = getConversationName(conv, user)
        const sheetAvatar = getConversationAvatar(conv, user)
        const otherId = conv.other_user_id
        const isMuted = mutedConvs.includes(conv.id)
        const isFav = favorites.includes(conv.id)
        const isBlocked = otherId ? blockedUsers.includes(otherId) : false
        return (
          <>
            <div className="chat-list__sheet-overlay" onClick={() => setContextMenu(null)} />
            <div className="chat-list__sheet">
              {/* Header */}
              <div className="chat-list__sheet-header">
                <div className="chat-list__sheet-user">
                  <div className="chat-list__sheet-avatar">
                    {sheetAvatar ? <img src={sheetAvatar} alt="" /> : <User size={22} />}
                  </div>
                  <span className="chat-list__sheet-name">{sheetName}</span>
                </div>
                <button className="chat-list__sheet-close" onClick={() => setContextMenu(null)}>
                  <X size={20} />
                </button>
              </div>

              {/* Options */}
              <div className="chat-list__sheet-options">
                <button className="chat-list__sheet-item" onClick={() => { toggleMuteConv(conv.id); setContextMenu(null) }}>
                  {isMuted ? <Bell size={20} /> : <BellOff size={20} />}
                  <span>{isMuted ? 'Activar notificaciones' : 'Silenciar'}</span>
                </button>

                <button className="chat-list__sheet-item" onClick={() => { handleSelectConversation(conv); setContextMenu(null) }}>
                  <Info size={20} />
                  <span>Info. del contacto</span>
                </button>

                <button className="chat-list__sheet-item" onClick={() => { toggleFavorite(conv.id); setContextMenu(null) }}>
                  <Heart size={20} className={isFav ? 'chat-list__sheet-fav-active' : ''} />
                  <span>{isFav ? 'Quitar de Favoritos' : 'Añadir a Favoritos'}</span>
                </button>

                <button className="chat-list__sheet-item" onClick={handleClearChat}>
                  <XCircle size={20} />
                  <span>Vaciar chat</span>
                </button>
              </div>

              {/* Danger zone */}
              <div className="chat-list__sheet-danger">
                {otherId && (
                  <button className="chat-list__sheet-item chat-list__sheet-item--danger" onClick={() => { toggleBlockUser(otherId, sheetName); setContextMenu(null) }}>
                    <Ban size={20} />
                    <span>{isBlocked ? `Desbloquear a ${sheetName}` : `Bloquear a ${sheetName}`}</span>
                  </button>
                )}
                <button className="chat-list__sheet-item chat-list__sheet-item--danger" onClick={handleDeleteConversation}>
                  <Trash2 size={20} />
                  <span>Eliminar chat</span>
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {/* Story FAB — mobile only */}
      <button className="chat-list__fab" onClick={() => window.dispatchEvent(new Event('openStoryCreate'))}>
        <Camera size={24} />
      </button>
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

/** Format preview — detect media URLs and show friendly labels */
function formatPreview(content) {
  if (!content) return ''
  const c = content.trim()
  // Image URLs
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(c) || /^https?:\/\/.*\b(image|img|photo|pic)\b/i.test(c)) return '📷 Imagen'
  // Backblaze / S3 image URLs
  if (/^https?:\/\/s3\..*backblaz/i.test(c) || /^https?:\/\/.*\.b2\..*backblaz/i.test(c)) return '📷 Imagen'
  // S3 generic
  if (/^https?:\/\/s3[\.-].*\.(jpg|jpeg|png|gif|webp)/i.test(c)) return '📷 Imagen'
  // Video URLs
  if (/\.(mp4|mov|avi|webm|mkv)(\?.*)?$/i.test(c)) return '🎥 Video'
  // Audio URLs
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(c)) return '🎵 Audio'
  // Document URLs
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z)(\?.*)?$/i.test(c)) return '📎 Archivo'
  // GIF (Tenor/Giphy)
  if (/tenor\.com|giphy\.com/i.test(c) || /\.gif(\?.*)?$/i.test(c)) return 'GIF'
  // Generic long URL (not text)
  if (/^https?:\/\/.{40,}$/i.test(c) && !c.includes(' ')) return '📷 Imagen'
  return c
}

export default ChatList
