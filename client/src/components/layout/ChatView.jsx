import { useRef, useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, MoreVertical, Send, Smile, Loader2, X, Mail, Calendar, User, Mic, Square, Play, Pause, Phone, Trash2
} from 'lucide-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import { getSocket } from '../../lib/socket'
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
  const inputRef = useRef(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [msgContextMenu, setMsgContextMenu] = useState(null)
  const msgLongPressRef = useRef(null)

  // Voice note state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)

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

  // Listen for deleted messages
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onMsgDeleted = ({ messageId }) => {
      useChatStore.setState(state => ({
        messages: state.messages.filter(m => m.id !== messageId)
      }))
    }
    socket.on('message_deleted', onMsgDeleted)
    return () => socket.off('message_deleted', onMsgDeleted)
  }, [])

  // Delete a message
  const handleDeleteMessage = useCallback(() => {
    if (!msgContextMenu) return
    const { msg } = msgContextMenu
    if (msg.sender_id !== user?.id) {
      setMsgContextMenu(null)
      return
    }
    const socket = getSocket()
    if (socket) {
      socket.emit('delete_message', { messageId: msg.id, conversationId: activeConversation?.id })
      // Optimistic remove
      useChatStore.setState(state => ({
        messages: state.messages.filter(m => m.id !== msg.id)
      }))
    }
    setMsgContextMenu(null)
  }, [msgContextMenu, user, activeConversation])

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
    setShowEmojiPicker(false)
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

  // --- Voice Recording ---
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Check supported mime types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : ''
      
      const options = mimeType ? { mimeType } : {}
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      })

      mediaRecorder.addEventListener('stop', () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        if (blob.size > 0 && !mediaRecorderRef.current._cancelled) {
          const reader = new FileReader()
          reader.onload = () => {
            sendMessage(reader.result, 'audio')
          }
          reader.readAsDataURL(blob)
        }
        audioChunksRef.current = []
      })

      mediaRecorder.start(100) // timeslice 100ms for collecting chunks progressively
      setIsRecording(true)
      setRecordingDuration(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1)
      }, 1000)
    } catch (err) {
      console.error('Microphone error:', err)
    }
  }

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return
    mediaRecorderRef.current._cancelled = false
    mediaRecorderRef.current.stop()
    clearInterval(recordingTimerRef.current)
    setIsRecording(false)
    setRecordingDuration(0)
  }

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current._cancelled = true
      mediaRecorderRef.current.stop()
    }
    clearInterval(recordingTimerRef.current)
    setIsRecording(false)
    setRecordingDuration(0)
    audioChunksRef.current = []
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
  const groupedMessages = groupMessages(messages, user)

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

        <div className="chat-view__header-info" onClick={() => setShowContactInfo(true)} style={{ cursor: 'pointer' }}>
          <div className="chat-view__header-name">{otherName}</div>
          <div className={`chat-view__header-subtitle ${typingUser ? 'chat-view__header-subtitle--typing' : ''}`}>
            {typingUser
              ? 'escribiendo...'
              : 'En línea' /* TODO: estado real de presencia */
            }
          </div>
        </div>

        <div className="chat-view__header-actions">
          <button
            className="chat-view__header-btn"
            aria-label="Llamar"
            onClick={() => {
              const otherId = activeConversation.other_user_id
                || activeConversation.participants?.find(p => p.id !== user?.id)?.id
              console.log('📞 Calling user:', otherId, otherName)
              if (otherId && window.__fenixStartCall) {
                window.__fenixStartCall(otherId, otherName, otherAvatar)
              } else {
                console.warn('❌ No user ID found:', JSON.stringify(activeConversation))
              }
            }}
          >
            <Phone size={18} />
          </button>
          <button className="chat-view__header-btn" aria-label="Más opciones">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* --- Contact Info Panel (Full screen) --- */}
      {showContactInfo && (() => {
        const other = activeConversation.participants?.find(p => p.id !== user?.id)
        const memberSince = other?.created_at || activeConversation.created_at
        const otherStatus = other?.status_text || activeConversation.other_status_text || ''
        const otherEmoji = other?.status_emoji || activeConversation.other_status_emoji || ''
        const otherEmail = other?.email || ''
        const otherDisplay = other?.display_name || ''

        return (
          <div className="contact-profile" onClick={() => setShowContactInfo(false)}>
            <div className="contact-profile__content" onClick={(e) => e.stopPropagation()}>
              
              {/* Header con foto grande */}
              <div className="contact-profile__hero">
                <button className="contact-profile__close" onClick={() => setShowContactInfo(false)}>
                  <X size={22} />
                </button>
                
                <div className="contact-profile__photo">
                  {otherAvatar ? (
                    <img src={otherAvatar} alt={otherName} className="contact-profile__photo-img" />
                  ) : (
                    <div className="contact-profile__photo-fallback">
                      {getInitials(otherName)}
                    </div>
                  )}
                  <div className="contact-profile__online-ring" />
                </div>

                <h2 className="contact-profile__name">{otherDisplay || otherName}</h2>
                <div className="contact-profile__handle">@{activeConversation.other_username || otherName}</div>
                <div className="contact-profile__online-text">
                  <span className="contact-profile__online-dot" />
                  En línea
                </div>

                {otherStatus && (
                  <div className="contact-profile__status-badge">
                    {otherEmoji} {otherStatus}
                  </div>
                )}
              </div>

              {/* Info cards */}
              <div className="contact-profile__info">
                <div className="contact-profile__card">
                  <div className="contact-profile__card-icon" style={{ color: '#00F5FF' }}>
                    <User size={18} />
                  </div>
                  <div className="contact-profile__card-text">
                    <span className="contact-profile__card-label">Nombre de usuario</span>
                    <span className="contact-profile__card-value">@{activeConversation.other_username || otherName}</span>
                  </div>
                </div>

                {otherDisplay && (
                  <div className="contact-profile__card">
                    <div className="contact-profile__card-icon" style={{ color: '#FF2DAA' }}>
                      <Smile size={18} />
                    </div>
                    <div className="contact-profile__card-text">
                      <span className="contact-profile__card-label">Nombre</span>
                      <span className="contact-profile__card-value">{otherDisplay}</span>
                    </div>
                  </div>
                )}

                <div className="contact-profile__card">
                  <div className="contact-profile__card-icon" style={{ color: '#6C63FF' }}>
                    <Calendar size={18} />
                  </div>
                  <div className="contact-profile__card-text">
                    <span className="contact-profile__card-label">Miembro desde</span>
                    <span className="contact-profile__card-value">
                      {new Date(memberSince).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="contact-profile__card">
                  <div className="contact-profile__card-icon" style={{ color: '#FFD93D' }}>
                    <Mail size={18} />
                  </div>
                  <div className="contact-profile__card-text">
                    <span className="contact-profile__card-label">Mensajes en esta conversación</span>
                    <span className="contact-profile__card-value">{messages.length} mensajes</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )
      })()}

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
                  <div
                    key={msg.id}
                    className="chat-view__msg-text"
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setMsgContextMenu({ x: e.clientX, y: e.clientY, msg })
                    }}
                    onTouchStart={() => {
                      msgLongPressRef.current = setTimeout(() => {
                        setMsgContextMenu({ x: window.innerWidth / 2, y: window.innerHeight / 2, msg })
                      }, 500)
                    }}
                    onTouchEnd={() => { if (msgLongPressRef.current) clearTimeout(msgLongPressRef.current) }}
                    onTouchMove={() => { if (msgLongPressRef.current) clearTimeout(msgLongPressRef.current) }}
                  >
                    {msg.type === 'audio' ? (
                      <AudioMessage src={msg.content} />
                    ) : msg.type === 'system' ? (
                      <span className="chat-view__msg-system">{msg.content}</span>
                    ) : (
                      msg.content
                    )}
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

      {/* --- Message Context Menu --- */}
      {msgContextMenu && (
        <>
          <div className="chat-list__context-overlay" onClick={() => setMsgContextMenu(null)} />
          <div className="chat-list__context-menu" style={{ top: Math.min(msgContextMenu.y, window.innerHeight - 60), left: Math.min(msgContextMenu.x, window.innerWidth - 200) }}>
            {msgContextMenu.msg.sender_id === user?.id ? (
              <button className="chat-list__context-item chat-list__context-item--danger" onClick={handleDeleteMessage}>
                <Trash2 size={16} />
                <span>Eliminar mensaje</span>
              </button>
            ) : (
              <button className="chat-list__context-item" onClick={() => setMsgContextMenu(null)}>
                <span>No puedes eliminar este mensaje</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* --- Emoji Picker --- */}
      {showEmojiPicker && (
        <div className="chat-view__emoji-picker">
          <EmojiPicker
            theme={Theme.DARK}
            onEmojiClick={(emojiData) => {
              setInputValue(prev => prev + emojiData.emoji)
              inputRef.current?.focus()
            }}
            width="100%"
            height={350}
            searchPlaceHolder="Buscar emoji..."
            previewConfig={{ showPreview: false }}
            skinTonesDisabled
            lazyLoadEmojis
          />
        </div>
      )}

      {/* --- Input bar --- */}
      <div className="chat-view__input-bar">
        <div className="chat-view__input-wrapper">
          <button
            className={`chat-view__input-btn ${showEmojiPicker ? 'chat-view__input-btn--active' : ''}`}
            aria-label="Emoji"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile size={20} />
          </button>
          <input
            ref={inputRef}
            type="text"
            className="chat-view__input"
            placeholder="Escribe un mensaje..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowEmojiPicker(false)}
          />
        </div>

        {/* Recording UI */}
        {isRecording ? (
          <div className="chat-view__recording">
            <div className="chat-view__recording-indicator">
              <span className="chat-view__recording-dot" />
              <span className="chat-view__recording-time">
                {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <button
              className="chat-view__recording-cancel"
              onClick={handleCancelRecording}
              aria-label="Cancelar"
            >
              <X size={18} />
            </button>
            <button
              className="chat-view__recording-stop"
              onClick={handleStopRecording}
              aria-label="Enviar nota de voz"
            >
              <Send size={18} />
            </button>
          </div>
        ) : inputValue.trim() ? (
          <button
            className="chat-view__send-btn chat-view__send-btn--active"
            aria-label="Enviar"
            onClick={handleSend}
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            className="chat-view__mic-btn"
            aria-label="Nota de voz"
            onClick={handleStartRecording}
          >
            <Mic size={20} />
          </button>
        )}
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
function groupMessages(messages, currentUser) {
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
        isOwn: senderId === currentUser?.id,
        showDateSeparator,
        messages: [msg],
      }
      groups.push(currentGroup)
    }
  })

  return groups
}

/** Audio message player component */
function AudioMessage({ src }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
    }
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => { setIsPlaying(false); setProgress(0) }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const formatDur = (s) => {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="audio-msg">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button className="audio-msg__play" onClick={togglePlay}>
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="audio-msg__waveform">
        <div className="audio-msg__bars">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="audio-msg__bar"
              style={{
                height: `${15 + Math.sin(i * 0.8) * 12 + Math.random() * 8}px`,
                opacity: progress > (i / 20) * 100 ? 1 : 0.3,
              }}
            />
          ))}
        </div>
        <div className="audio-msg__time">{formatDur(duration)}</div>
      </div>
    </div>
  )
}

export default ChatView
