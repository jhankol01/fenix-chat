import { useRef, useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, MoreVertical, Send, Smile, Loader2
} from 'lucide-react'
import useChatStore from '../../stores/chatStore'
import useAuthStore from '../../stores/authStore'
import './ChatView.css'

/**
 * ChatView — Vista principal del chat con mensajes reales
 * Recibe la conversación activa del chatStore
 * Muestra mensajes, input, typing, auto-scroll, y carga de más mensajes
 */
function ChatView({ onBack }) {
  const [inputValue, setInputValue] = useState('')
  const [isTypingLocal, setIsTypingLocal] = useState(false)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const touchStartRef = useRef(null)

  const {
    activeConversation,
    messages,
    typingUsers,
    isLoadingMessages,
    hasMoreMessages,
    sendMessage,
    loadMessages,
    setTyping,
    stopTyping,
  } = useChatStore()

  const user = useAuthStore(state => state.user)

  // Auto-scroll al fondo cuando llegan nuevos mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Scroll al fondo inicialmente cuando se cargan los mensajes
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' })
    }
  }, [activeConversation?.id])

  // Cargar más mensajes al hacer scroll arriba
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container || isLoadingMessages || !hasMoreMessages) return

    if (container.scrollTop < 60 && messages.length > 0) {
      const oldestMessage = messages[0]
      if (oldestMessage?.created_at) {
        loadMessages(activeConversation.id, oldestMessage.created_at)
      }
    }
  }, [isLoadingMessages, hasMoreMessages, messages, activeConversation, loadMessages])

  // Manejar envío de mensaje
  const handleSend = () => {
    if (!inputValue.trim()) return
    sendMessage(inputValue)
    setInputValue('')
    handleStopTyping()
  }

  // Enter para enviar
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Indicador de escritura con debounce
  const handleInputChange = (e) => {
    setInputValue(e.target.value)

    if (!isTypingLocal && activeConversation) {
      setIsTypingLocal(true)
      setTyping(activeConversation.id)
    }

    // Reset del timeout de typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping()
    }, 2000)
  }

  const handleStopTyping = () => {
    if (isTypingLocal && activeConversation) {
      setIsTypingLocal(false)
      stopTyping(activeConversation.id)
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
  }

  // Swipe-right para volver (edge swipe desde la izquierda)
  const handleTouchStart = (e) => {
    const startX = e.touches[0].clientX
    if (startX <= 40) {
      touchStartRef.current = startX
    } else {
      touchStartRef.current = null
    }
  }

  const handleTouchEnd = (e) => {
    if (touchStartRef.current === null) return
    const endX = e.changedTouches[0].clientX
    const deltaX = endX - touchStartRef.current
    if (deltaX > 80 && onBack) {
      onBack()
    }
    touchStartRef.current = null
  }

  if (!activeConversation) return null

  // Datos de la conversación
  const otherName = getConversationName(activeConversation, user)
  const otherAvatar = getConversationAvatar(activeConversation, user)
  const typingUser = typingUsers[activeConversation.id]

  // Agrupar mensajes consecutivos del mismo usuario
  const groupedMessages = groupMessages(messages)

  // Formatear hora del mensaje
  const formatMessageTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  // Formatear fecha para separadores
  const formatDateSeparator = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Hoy'
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer'
    return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <div
      className="chat-view"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* --- Header --- */}
      <div className="chat-view__header">
        <button
          className="chat-view__back-btn"
          onClick={onBack}
          aria-label="Volver a la lista"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="chat-view__header-avatar">
          {otherAvatar ? (
            <img src={otherAvatar} alt={otherName} className="chat-view__header-avatar-img" />
          ) : (
            getInitials(otherName)
          )}
        </div>

        <div className="chat-view__header-info">
          <div className="chat-view__header-name">{otherName}</div>
          <div className={`chat-view__header-subtitle ${typingUser ? 'chat-view__header-subtitle--typing' : ''}`}>
            {typingUser
              ? 'escribiendo...'
              : 'En línea' /* TODO: estado real de presencia */
            }
          </div>
        </div>

        <div className="chat-view__header-actions">
          <button className="chat-view__header-btn" aria-label="Más opciones">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* --- Mensajes --- */}
      <div
        className="chat-view__messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {/* Indicador de carga de más mensajes */}
        {isLoadingMessages && (
          <div className="chat-view__loading-more">
            <Loader2 size={20} className="chat-view__spinner" />
            <span>Cargando mensajes...</span>
          </div>
        )}

        {/* Mensajes agrupados */}
        {groupedMessages.map((group, groupIdx) => (
          <div key={group.key}>
            {/* Separador de fecha */}
            {group.showDateSeparator && (
              <div className="chat-view__date-separator">
                <span className="chat-view__date-separator-text">
                  {formatDateSeparator(group.messages[0].created_at)}
                </span>
              </div>
            )}

            <div
              className={`chat-view__msg-group ${group.isOwn ? 'chat-view__msg-group--own' : ''}`}
            >
              {/* Avatar del remitente */}
              <div className="chat-view__msg-avatar">
                {group.avatar ? (
                  <img src={group.avatar} alt={group.username} className="chat-view__msg-avatar-img" />
                ) : (
                  getInitials(group.username)
                )}
              </div>

              {/* Cuerpo de los mensajes */}
              <div className="chat-view__msg-body">
                <div className="chat-view__msg-header">
                  <span className="chat-view__msg-username">{group.username}</span>
                  <span className="chat-view__msg-time">
                    {formatMessageTime(group.messages[0].created_at)}
                  </span>
                </div>

                {group.messages.map((msg) => (
                  <div key={msg.id} className="chat-view__msg-text">
                    {msg.content}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Indicador de escritura */}
        {typingUser && (
          <div className="chat-view__typing-indicator">
            <div className="chat-view__msg-avatar chat-view__msg-avatar--typing">
              {otherAvatar ? (
                <img src={otherAvatar} alt={otherName} className="chat-view__msg-avatar-img" />
              ) : (
                getInitials(otherName)
              )}
            </div>
            <div className="chat-view__typing-bubble">
              <span className="chat-view__typing-dot" />
              <span className="chat-view__typing-dot" />
              <span className="chat-view__typing-dot" />
            </div>
          </div>
        )}

        {/* Ancla para auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* --- Input bar --- */}
      <div className="chat-view__input-bar">
        <div className="chat-view__input-wrapper">
          <button className="chat-view__input-btn" aria-label="Emoji">
            <Smile size={20} />
          </button>
          <input
            type="text"
            className="chat-view__input"
            placeholder="Escribe un mensaje..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          className={`chat-view__send-btn ${inputValue.trim() ? 'chat-view__send-btn--active' : ''}`}
          aria-label="Enviar"
          onClick={handleSend}
          disabled={!inputValue.trim()}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}

// --- Utilidades ---

/** Obtener nombre de la conversación */
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

/** Obtener iniciales */
function getInitials(name) {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

/**
 * Agrupar mensajes consecutivos del mismo usuario
 * con separadores de fecha entre días distintos
 */
function groupMessages(messages) {
  const groups = []
  let currentGroup = null
  let lastDate = null

  messages.forEach((msg, idx) => {
    const msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : null
    const showDateSeparator = msgDate && msgDate !== lastDate
    lastDate = msgDate

    const senderId = msg.sender_id || msg.user_id
    const senderName = msg.sender_username || msg.username || 'Usuario'
    const senderAvatar = msg.sender_avatar_url || msg.avatar_url || null

    // Si es del mismo usuario y no necesitamos separador de fecha, agrupar
    if (
      currentGroup &&
      currentGroup.senderId === senderId &&
      !showDateSeparator
    ) {
      currentGroup.messages.push(msg)
    } else {
      // Nuevo grupo
      currentGroup = {
        key: `group-${idx}`,
        senderId,
        username: senderName,
        avatar: senderAvatar,
        isOwn: msg.is_own || false,
        showDateSeparator,
        messages: [msg],
      }
      groups.push(currentGroup)
    }
  })

  return groups
}

export default ChatView
