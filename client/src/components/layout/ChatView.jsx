import { useRef, useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, MoreVertical, Send, Smile, Loader2, X, Mail, Calendar, User, Mic, Square, Play, Pause, Phone, Video, Trash2, UserPlus, UserCheck, Paperclip, Image, Camera, Reply, Ban, Search, Forward
} from 'lucide-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import { getSocket } from '../../lib/socket'
import useChatStore from '../../stores/chatStore'
import useAuthStore from '../../stores/authStore'
import api from '../../lib/api'
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
  const [isContact, setIsContact] = useState(null) // null=loading, true/false
  const [addingContact, setAddingContact] = useState(false)
  const [msgContextMenu, setMsgContextMenu] = useState(null)
  const msgLongPressRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [chatBgStyle, setChatBgStyle] = useState({})

  // Reactions state
  const [reactionsMap, setReactionsMap] = useState({})
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null)
  const reactionEmojis = ['👍', '🔥', '😂', '😍', '😢', '🙏']

  // Reply state
  const [replyingTo, setReplyingTo] = useState(null)

  // Search state
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])

  // Forward state
  const [forwardingMsg, setForwardingMsg] = useState(null)

  // GIF picker state
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearchQuery, setGifSearchQuery] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [isLoadingGifs, setIsLoadingGifs] = useState(false)
  const gifSearchTimeoutRef = useRef(null)

  // Voice note state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)

  const {
    activeConversation,
    conversations,
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

  // Gradient presets map
  const GRADIENT_MAP = {
    'gradient-1': 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    'gradient-2': 'linear-gradient(135deg, #141E30, #243B55)',
    'gradient-3': 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
    'gradient-4': 'linear-gradient(135deg, #2d1b69, #11001c)',
    'gradient-5': 'linear-gradient(135deg, #1f1c2c, #928DAB)',
    'gradient-6': 'linear-gradient(135deg, #0a0a0a, #1a1a1a)',
  }

  const PATTERN_MAP = {
    'fenix-dark': '/backgrounds/fenix-dark.png',
    'fenix-light': '/backgrounds/fenix-light.png',
  }

  // Fetch chat background preference
  useEffect(() => {
    api.get('/preferences').then(data => {
      const bg = data?.preferences?.chat_bg
      if (!bg || bg === 'default') {
        setChatBgStyle({})  // CSS already has fenix-dark as default
      } else if (PATTERN_MAP[bg]) {
        setChatBgStyle({
          backgroundImage: `url(${PATTERN_MAP[bg]})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        })
      } else if (bg.startsWith('gradient-') && GRADIENT_MAP[bg]) {
        setChatBgStyle({ background: GRADIENT_MAP[bg] })
      } else if (bg.startsWith('http')) {
        setChatBgStyle({
          backgroundImage: `url(${bg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        })
      }
    }).catch(() => {})
  }, [])

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

  // Listen for reactions_updated
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onReactionsUpdated = ({ messageId, reactions }) => {
      setReactionsMap(prev => ({ ...prev, [messageId]: reactions }))
    }
    socket.on('reactions_updated', onReactionsUpdated)
    return () => socket.off('reactions_updated', onReactionsUpdated)
  }, [])

  // Listen for delete_for_all
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onDeletedForAll = ({ messageId }) => {
      useChatStore.setState(state => ({
        messages: state.messages.map(m =>
          m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
        )
      }))
    }
    socket.on('message_deleted_for_all', onDeletedForAll)
    return () => socket.off('message_deleted_for_all', onDeletedForAll)
  }, [])

  // Listen for read receipts (messages_seen)
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onSeen = (data) => useChatStore.getState().handleMessagesSeen(data)
    socket.on('messages_seen', onSeen)
    return () => socket.off('messages_seen', onSeen)
  }, [])

  // Mark messages as seen when viewing a conversation
  useEffect(() => {
    if (activeConversation?.id && messages.length > 0) {
      useChatStore.getState().markSeen(activeConversation.id)
    }
  }, [activeConversation?.id, messages.length])

  // Check if other user is in contacts
  useEffect(() => {
    const otherId = activeConversation?.other_user_id
      || activeConversation?.participants?.find(p => p.id !== user?.id)?.id
    if (!otherId) return
    setIsContact(null)
    api.get('/contacts').then(data => {
      const found = (data.contacts || []).some(c => c.contact_id === otherId)
      setIsContact(found)
    }).catch(() => setIsContact(false))
  }, [activeConversation?.id, user?.id])

  // Add contact from chat
  const handleAddContact = async () => {
    const otherId = activeConversation?.other_user_id
      || activeConversation?.participants?.find(p => p.id !== user?.id)?.id
    if (!otherId) return
    setAddingContact(true)
    try {
      await api.post('/contacts', { contactId: otherId })
      setIsContact(true)
    } catch (err) {
      console.error('Add contact error:', err)
    } finally {
      setAddingContact(false)
    }
  }

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

  // Delete for all
  const handleDeleteForAll = useCallback(() => {
    if (!msgContextMenu) return
    const { msg } = msgContextMenu
    if (msg.sender_id !== user?.id) {
      setMsgContextMenu(null)
      return
    }
    const socket = getSocket()
    if (socket) {
      socket.emit('delete_for_all', { messageId: msg.id, conversationId: activeConversation?.id })
      // Optimistic: mark as deleted
      useChatStore.setState(state => ({
        messages: state.messages.map(m =>
          m.id === msg.id ? { ...m, deleted_at: new Date().toISOString() } : m
        )
      }))
    }
    setMsgContextMenu(null)
  }, [msgContextMenu, user, activeConversation])

  // Handle reaction tap
  const handleAddReaction = useCallback((messageId, emoji) => {
    const socket = getSocket()
    if (!socket || !activeConversation) return
    // Check if user already reacted with this emoji
    const reactions = reactionsMap[messageId] || []
    const existing = reactions.find(r => r.emoji === emoji)
    const alreadyReacted = existing && existing.user_ids?.includes(user?.id)
    if (alreadyReacted) {
      socket.emit('remove_reaction', { messageId, conversationId: activeConversation.id, emoji })
    } else {
      socket.emit('add_reaction', { messageId, conversationId: activeConversation.id, emoji })
    }
    setReactionPickerMsgId(null)
  }, [activeConversation, reactionsMap, user])

  // Handle reply
  const handleReply = useCallback(() => {
    if (!msgContextMenu) return
    setReplyingTo(msgContextMenu.msg)
    setMsgContextMenu(null)
    inputRef.current?.focus()
  }, [msgContextMenu])

  // Search messages
  const handleSearch = useCallback((q) => {
    setSearchQuery(q)
    if (!q.trim() || !activeConversation) {
      setSearchResults([])
      return
    }
    const socket = getSocket()
    if (socket) {
      socket.emit('search_messages', { conversationId: activeConversation.id, searchQuery: q.trim() })
    }
  }, [activeConversation])

  // Listen for search results
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onResults = ({ results }) => setSearchResults(results || [])
    socket.on('search_results', onResults)
    return () => socket.off('search_results', onResults)
  }, [])

  // Forward message
  const handleForward = useCallback(() => {
    if (!msgContextMenu) return
    setForwardingMsg(msgContextMenu.msg)
    setMsgContextMenu(null)
  }, [msgContextMenu])

  const doForward = useCallback((targetConvId) => {
    if (!forwardingMsg) return
    const socket = getSocket()
    if (socket) {
      socket.emit('send_message', {
        conversationId: targetConvId,
        content: forwardingMsg.content,
        type: forwardingMsg.type || 'text',
        forwarded: true,
      })
    }
    setForwardingMsg(null)
  }, [forwardingMsg])

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

  // GIF search with debounce
  const handleGifSearch = useCallback((query) => {
    setGifSearchQuery(query)
    if (gifSearchTimeoutRef.current) clearTimeout(gifSearchTimeoutRef.current)
    if (!query.trim()) {
      setGifResults([])
      return
    }
    gifSearchTimeoutRef.current = setTimeout(async () => {
      setIsLoadingGifs(true)
      try {
        const data = await api.get(`/gifs/search?q=${encodeURIComponent(query)}`)
        setGifResults(data.results || [])
      } catch (err) {
        console.error('GIF search error:', err)
        setGifResults([])
      } finally {
        setIsLoadingGifs(false)
      }
    }, 400)
  }, [])

  // Load trending GIFs when panel opens
  useEffect(() => {
    if (showGifPicker && gifResults.length === 0 && !gifSearchQuery) {
      setIsLoadingGifs(true)
      api.get('/gifs/trending')
        .then(data => setGifResults(data.results || []))
        .catch(() => setGifResults([]))
        .finally(() => setIsLoadingGifs(false))
    }
  }, [showGifPicker])

  // Send a GIF as image message
  const handleSendGif = useCallback((gifUrl) => {
    sendMessage(gifUrl, 'image', replyingTo?.id || null)
    setShowGifPicker(false)
    setGifSearchQuery('')
    setGifResults([])
    setReplyingTo(null)
  }, [sendMessage, replyingTo])

  // Manejar envío de mensaje
  const handleSend = () => {
    if (!inputValue.trim()) return
    sendMessage(inputValue, 'text', replyingTo?.id || null)
    setInputValue('')
    setShowEmojiPicker(false)
    setShowGifPicker(false)
    setReplyingTo(null)
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
          // Upload to B2 instead of base64
          const formData = new FormData()
          formData.append('media', blob, `voice-note.${mimeType === 'audio/ogg' ? 'ogg' : 'webm'}`)
          api.upload('/upload/media', formData).then(data => {
            sendMessage(data.url, 'audio')
          }).catch(err => {
            console.error('Audio upload error:', err)
          })
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
  const otherId = activeConversation.other_user_id
  const onlineUsers = useChatStore(s => s.onlineUsers)
  const isOtherOnline = otherId ? onlineUsers.has(otherId) : false

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
              : isOtherOnline
                ? <><span className="chat-view__online-dot" /> En línea</>
                : 'Desconectado'
            }
          </div>
        </div>

        <div className="chat-view__header-actions">
          <button
            className="chat-view__header-btn"
            aria-label="Buscar"
            onClick={() => { setShowSearch(s => !s); setSearchQuery(''); setSearchResults([]) }}
          >
            <Search size={18} />
          </button>
          {/* Add contact button */}
          {isContact === false && (
            <button
              className="chat-view__header-btn chat-view__header-btn--add-contact"
              onClick={handleAddContact}
              disabled={addingContact}
              aria-label="Agregar contacto"
            >
              {addingContact ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
            </button>
          )}
          {isContact === true && (
            <span className="chat-view__contact-badge">
              <UserCheck size={14} />
            </span>
          )}
          <button
            className="chat-view__header-btn"
            aria-label="Llamar"
            onClick={() => {
              const otherId = activeConversation.other_user_id
                || activeConversation.participants?.find(p => p.id !== user?.id)?.id
              if (otherId && window.__fenixStartCall) {
                window.__fenixStartCall(otherId, otherName, otherAvatar, false)
              }
            }}
          >
            <Phone size={18} />
          </button>
          <button
            className="chat-view__header-btn"
            aria-label="Videollamada"
            onClick={() => {
              const otherId = activeConversation.other_user_id
                || activeConversation.participants?.find(p => p.id !== user?.id)?.id
              if (otherId && window.__fenixStartCall) {
                window.__fenixStartCall(otherId, otherName, otherAvatar, true)
              }
            }}
          >
            <Video size={18} />
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

                {/* Block user button */}
                <button
                  className="contact-profile__block-btn"
                  onClick={async () => {
                    const otherId = activeConversation?.other_user_id
                      || activeConversation?.participants?.find(p => p.id !== user?.id)?.id
                    if (!otherId) return
                    if (window.confirm(`¿Bloquear a ${otherDisplay || otherName}? No podrá enviarte mensajes.`)) {
                      try {
                        await api.post(`/users/block/${otherId}`)
                        alert('Usuario bloqueado')
                        setShowContactInfo(false)
                      } catch (err) {
                        console.error('Error blocking:', err)
                      }
                    }
                  }}
                >
                  🚫 Bloquear usuario
                </button>
              </div>

            </div>
          </div>
        )
      })()}

      {/* --- Search bar --- */}
      {showSearch && (
        <div className="chat-view__search-bar">
          <Search size={16} className="chat-view__search-icon" />
          <input
            type="text"
            className="chat-view__search-input"
            placeholder="Buscar en este chat..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <span className="chat-view__search-count">{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}</span>
          )}
          <button className="chat-view__search-close" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search results overlay */}
      {showSearch && searchResults.length > 0 && (
        <div className="chat-view__search-results">
          {searchResults.map(r => (
            <div key={r.id} className="chat-view__search-result-item">
              <span className="chat-view__search-result-time">
                {new Date(r.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
              </span>
              <span className="chat-view__search-result-text">{r.content?.slice(0, 100)}</span>
            </div>
          ))}
        </div>
      )}

      {/* --- Mensajes --- */}
      <div
        className="chat-view__messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={chatBgStyle}
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

                {group.messages.map((msg, msgIdx) => (
                  <div key={msg.id} className="chat-view__msg-wrapper">
                    {/* Reaction picker floating bar */}
                    {reactionPickerMsgId === msg.id && (
                      <div className={`chat-view__reaction-picker ${group.isOwn ? 'chat-view__reaction-picker--own' : ''}`}>
                        {reactionEmojis.map(emoji => (
                          <button
                            key={emoji}
                            className="chat-view__reaction-picker-btn"
                            onClick={() => handleAddReaction(msg.id, emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <div
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
                      onDoubleClick={() => {
                        if (!msg.deleted_at) setReactionPickerMsgId(prev => prev === msg.id ? null : msg.id)
                      }}
                    >
                      {/* Forwarded label */}
                      {msg.forwarded && (
                        <div className="chat-view__forwarded-label">↗ Reenviado</div>
                      )}

                      {/* Reply quoted block */}
                      {msg.reply_to_id && msg.reply_username && (
                        <div className="chat-view__reply-quote">
                          <span className="chat-view__reply-quote-user">@{msg.reply_username}</span>
                          <span className="chat-view__reply-quote-text">
                            {msg.reply_type === 'image' ? '📷 Foto'
                              : msg.reply_type === 'video' ? '🎥 Video'
                              : msg.reply_type === 'audio' ? '🎤 Nota de voz'
                              : (msg.reply_content || '').slice(0, 80)}{(msg.reply_content || '').length > 80 ? '…' : ''}
                          </span>
                        </div>
                      )}

                      {/* Deleted message */}
                      {msg.deleted_at ? (
                        <span className="chat-view__msg-deleted">🚫 Mensaje eliminado</span>
                      ) : msg.type === 'audio' ? (
                        <AudioMessage src={msg.content} />
                      ) : msg.type === 'image' ? (
                        <img
                          src={msg.content}
                          alt="Foto"
                          className="chat-view__msg-image"
                          onClick={() => setLightboxUrl(msg.content)}
                        />
                      ) : msg.type === 'video' ? (
                        <video
                          src={msg.content}
                          controls
                          className="chat-view__msg-video"
                          preload="metadata"
                        />
                      ) : msg.type === 'system' ? (
                        <span className="chat-view__msg-system">{msg.content}</span>
                      ) : (
                        msg.content
                      )}
                      {/* 🔥 Read receipt — en cada mensaje propio */}
                      {group.isOwn && msg.type !== 'system' && !msg.deleted_at && (
                        <span className={`chat-view__flame-receipt ${msg.seen_at ? 'chat-view__flame-receipt--seen' : ''}`}>
                          <span className="chat-view__check-marks">{msg.seen_at ? '✓✓' : '✓'}</span>
                        </span>
                      )}
                    </div>

                    {/* Reaction pills */}
                    {(reactionsMap[msg.id] || []).length > 0 && (
                      <div className={`chat-view__reactions ${group.isOwn ? 'chat-view__reactions--own' : ''}`}>
                        {reactionsMap[msg.id].map(r => (
                          <button
                            key={r.emoji}
                            className={`chat-view__reaction-pill ${r.user_ids?.includes(user?.id) ? 'chat-view__reaction-pill--active' : ''}`}
                            onClick={() => handleAddReaction(msg.id, r.emoji)}
                          >
                            {r.emoji} {r.count}
                          </button>
                        ))}
                      </div>
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
          <div className="chat-list__context-menu" style={{ top: Math.min(msgContextMenu.y, window.innerHeight - 120), left: Math.min(msgContextMenu.x, window.innerWidth - 200) }}>
            {/* Reply option — available for all messages */}
            {!msgContextMenu.msg.deleted_at && (
              <button className="chat-list__context-item" onClick={handleReply}>
                <Reply size={16} />
                <span>Responder</span>
              </button>
            )}
            {/* Reaction shortcut */}
            {!msgContextMenu.msg.deleted_at && (
              <button className="chat-list__context-item" onClick={() => {
                setReactionPickerMsgId(msgContextMenu.msg.id)
                setMsgContextMenu(null)
              }}>
                <Smile size={16} />
                <span>Reaccionar</span>
              </button>
            )}
            {/* Forward */}
            {!msgContextMenu.msg.deleted_at && (
              <button className="chat-list__context-item" onClick={handleForward}>
                <Forward size={16} />
                <span>Reenviar</span>
              </button>
            )}
            {msgContextMenu.msg.sender_id === user?.id && !msgContextMenu.msg.deleted_at && (
              <>
                <button className="chat-list__context-item chat-list__context-item--danger" onClick={handleDeleteMessage}>
                  <Trash2 size={16} />
                  <span>Eliminar mensaje</span>
                </button>
                <button className="chat-list__context-item chat-list__context-item--danger" onClick={handleDeleteForAll}>
                  <Ban size={16} />
                  <span>Eliminar para todos</span>
                </button>
              </>
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

      {/* --- GIF Picker Panel --- */}
      {showGifPicker && (
        <div className="chat-view__gif-panel">
          <div className="chat-view__gif-header">
            <div className="chat-view__gif-search-wrapper">
              <Search size={16} className="chat-view__gif-search-icon" />
              <input
                type="text"
                className="chat-view__gif-search-input"
                placeholder="Buscar GIFs..."
                value={gifSearchQuery}
                onChange={(e) => handleGifSearch(e.target.value)}
                autoFocus
              />
              {gifSearchQuery && (
                <button
                  className="chat-view__gif-search-clear"
                  onClick={() => { setGifSearchQuery(''); setGifResults([]); }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="chat-view__gif-grid">
            {isLoadingGifs ? (
              <div className="chat-view__gif-loading">
                <Loader2 size={24} className="chat-view__spinner" />
                <span>Buscando GIFs...</span>
              </div>
            ) : gifResults.length === 0 ? (
              <div className="chat-view__gif-empty">
                {gifSearchQuery ? 'No se encontraron GIFs' : 'Escribe para buscar GIFs'}
              </div>
            ) : (
              gifResults.map((gif) => {
                const gifUrl = gif.media_formats?.gif?.url || gif.media_formats?.mediumgif?.url || gif.media_formats?.tinygif?.url
                const previewUrl = gif.media_formats?.tinygif?.url || gif.media_formats?.nanogif?.url || gifUrl
                if (!gifUrl) return null
                return (
                  <button
                    key={gif.id}
                    className="chat-view__gif-item"
                    onClick={() => handleSendGif(gifUrl)}
                    title={gif.content_description || 'GIF'}
                  >
                    <img
                      src={previewUrl}
                      alt={gif.content_description || 'GIF'}
                      className="chat-view__gif-thumb"
                      loading="lazy"
                    />
                  </button>
                )
              })
            )}
          </div>
          <div className="chat-view__gif-footer">
            <span className="chat-view__gif-powered">Powered by Tenor</span>
          </div>
        </div>
      )}

      {/* --- Reply preview bar --- */}
      {replyingTo && (
        <div className="chat-view__reply-preview">
          <div className="chat-view__reply-preview-content">
            <span className="chat-view__reply-preview-icon">↩</span>
            <span className="chat-view__reply-preview-text">
              Respondiendo a <strong>@{replyingTo.sender_username || replyingTo.username || 'Usuario'}</strong>:{' '}
              {replyingTo.type === 'image' ? '📷 Foto'
                : replyingTo.type === 'video' ? '🎥 Video'
                : replyingTo.type === 'audio' ? '🎤 Nota de voz'
                : (replyingTo.content || '').slice(0, 60)}{(replyingTo.content || '').length > 60 ? '…' : ''}
            </span>
          </div>
          <button className="chat-view__reply-preview-close" onClick={() => setReplyingTo(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* --- Input bar --- */}
      <div className="chat-view__input-bar">
        <div className="chat-view__input-wrapper">
          <button
            className={`chat-view__input-btn ${showEmojiPicker ? 'chat-view__input-btn--active' : ''}`}
            aria-label="Emoji"
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false) }}
          >
            <Smile size={20} />
          </button>
          <button
            className={`chat-view__input-btn ${showGifPicker ? 'chat-view__input-btn--active' : ''}`}
            aria-label="GIF"
            onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false) }}
          >
            <span className="chat-view__gif-icon">GIF</span>
          </button>
          <button
            className="chat-view__input-btn"
            aria-label="Adjuntar"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={20} />
          </button>
          <button
            className="chat-view__input-btn"
            aria-label="Cámara"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              e.target.value = ''
              setIsUploading(true)
              try {
                const formData = new FormData()
                formData.append('media', file)
                const data = await api.upload('/upload/media', formData)
                sendMessage(data.url, data.type)
              } catch (err) {
                console.error('Upload error:', err)
                alert('Error al subir archivo')
              } finally {
                setIsUploading(false)
              }
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              e.target.value = ''
              setIsUploading(true)
              try {
                const formData = new FormData()
                formData.append('media', file)
                const data = await api.upload('/upload/media', formData)
                sendMessage(data.url, data.type)
              } catch (err) {
                console.error('Upload error:', err)
                alert('Error al subir archivo')
              } finally {
                setIsUploading(false)
              }
            }}
          />
          <input
            ref={inputRef}
            type="text"
            className="chat-view__input"
            placeholder="Escribe un mensaje..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { setShowEmojiPicker(false); setShowGifPicker(false) }}
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

        {/* Uploading indicator */}
        {isUploading && (
          <div className="chat-view__uploading">
            <Loader2 size={18} className="spin" />
            <span>Subiendo...</span>
          </div>
        )}
      </div>

      {/* Lightbox — visor de imagen fullscreen */}
      {lightboxUrl && (
        <div className="chat-view__lightbox" onClick={() => setLightboxUrl(null)}>
          <button className="chat-view__lightbox-close" onClick={() => setLightboxUrl(null)}>
            <X size={24} />
          </button>
          <img
            src={lightboxUrl}
            alt="Imagen"
            className="chat-view__lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* --- Forward modal --- */}
      {forwardingMsg && (
        <>
          <div className="chat-view__lightbox" onClick={() => setForwardingMsg(null)} />
          <div className="chat-view__forward-modal">
            <div className="chat-view__forward-header">
              <h3>Reenviar a...</h3>
              <button onClick={() => setForwardingMsg(null)}><X size={18} /></button>
            </div>
            <div className="chat-view__forward-preview">
              <span>↗</span>
              <span className="chat-view__forward-preview-text">
                {forwardingMsg.type === 'image' ? '📷 Foto'
                  : forwardingMsg.type === 'video' ? '🎥 Video'
                  : forwardingMsg.type === 'audio' ? '🎤 Audio'
                  : (forwardingMsg.content || '').slice(0, 60)}
              </span>
            </div>
            <div className="chat-view__forward-list">
              {conversations.filter(c => c.id !== activeConversation?.id).map(conv => {
                const name = getConversationName(conv, user)
                const avatar = getConversationAvatar(conv, user)
                return (
                  <button key={conv.id} className="chat-view__forward-item" onClick={() => doForward(conv.id)}>
                    <div className="chat-view__forward-item-avatar">
                      {avatar ? <img src={avatar} alt={name} /> : getInitials(name)}
                    </div>
                    <span>{name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

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
  if (conversation.type === 'group') return conversation.avatar_url || null
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
