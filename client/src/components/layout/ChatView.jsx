import { useRef, useState } from 'react'
import {
  ArrowLeft, Phone, Bell, MoreVertical,
  Smile, Paperclip, Mic, Send, Flame, Reply, X
} from 'lucide-react'
import './ChatView.css'

/**
 * Datos mock de comunidades
 */
const COMMUNITY_DATA = {
  'c1': {
    name: 'Gamers Zone',
    emoji: '🎮',
    gradient: 'linear-gradient(135deg, #00D4DD, #0066FF)',
    members: 24,
    voiceCount: 3,
    voiceUsers: [
      { initials: 'NC', bg: '#00D4DD' },
      { initials: 'LS', bg: '#FF2DAA' },
      { initials: 'DK', bg: '#8A00FF' },
    ],
  },
  'c2': {
    name: 'Design Team',
    emoji: '🎨',
    gradient: 'linear-gradient(135deg, #FF2DAA, #8A00FF)',
    members: 12,
    voiceCount: 0,
    voiceUsers: [],
  },
  'c3': {
    name: 'Music Lovers',
    emoji: '🎵',
    gradient: 'linear-gradient(135deg, #00E676, #00B8D4)',
    members: 18,
    voiceCount: 2,
    voiceUsers: [
      { initials: 'PA', bg: '#FFD740' },
      { initials: 'CW', bg: '#00E676' },
    ],
  },
  'c4': {
    name: 'Code Academy',
    emoji: '💻',
    gradient: 'linear-gradient(135deg, #8A00FF, #FF2DAA)',
    members: 31,
    voiceCount: 0,
    voiceUsers: [],
  },
}

/**
 * Datos mock de DMs
 */
const DM_DATA = {
  'd1': {
    name: 'NeonCoder',
    initials: 'NC',
    gradient: 'linear-gradient(135deg, #00F5FF, #0066FF)',
    photo: 'https://i.pravatar.cc/150?img=11',
    online: true,
    activity: { emoji: '🎮', text: 'Jugando Valorant' },
  },
  'd2': {
    name: 'Luna_Star',
    initials: 'LS',
    gradient: 'linear-gradient(135deg, #FF2DAA, #FF6B6B)',
    photo: 'https://i.pravatar.cc/150?img=5',
    online: true,
    activity: { emoji: '🎨', text: 'Diseñando' },
  },
  'd3': {
    name: 'DarkKnight',
    initials: 'DK',
    gradient: 'linear-gradient(135deg, #8A00FF, #4A00B4)',
    photo: 'https://i.pravatar.cc/150?img=12',
    online: false,
  },
  'd4': {
    name: 'PixelArtist',
    initials: 'PA',
    gradient: 'linear-gradient(135deg, #FF6B35, #FFD740)',
    photo: 'https://i.pravatar.cc/150?img=33',
    online: false,
  },
  'd5': {
    name: 'ByteStorm',
    initials: 'BS',
    gradient: 'linear-gradient(135deg, #00E676, #00B8D4)',
    photo: 'https://i.pravatar.cc/150?img=59',
    online: true,
    activity: { emoji: '💻', text: 'Programando' },
  },
}

/**
 * Mensajes mock — comunidad
 */
const COMMUNITY_MESSAGES = [
  {
    id: 1, userId: 'neon', username: 'NeonCoder', initials: 'NC',
    avatarBg: 'linear-gradient(135deg, #00D4DD, #0066FF)',
    photo: 'https://i.pravatar.cc/150?img=11',
    texts: ['Alguien quiere jugar ranked? 🎮'], time: '12:34', isOwn: false,
    reactions: { flame: 2 },
  },
  {
    id: 2, userId: 'luna', username: 'Luna_Star', initials: 'LS',
    avatarBg: 'linear-gradient(135deg, #FF2DAA, #8A00FF)',
    photo: 'https://i.pravatar.cc/150?img=5',
    texts: ['Yo me apunto!', 'Espero que no sea tan tarde 😅'], time: '12:35', isOwn: false,
  },
  {
    id: 3, userId: 'dark', username: 'DarkKnight', initials: 'DK',
    avatarBg: 'linear-gradient(135deg, #8A00FF, #5500cc)',
    photo: 'https://i.pravatar.cc/150?img=12',
    texts: ['Yo también, denme 5 min'], time: '12:37', isOwn: false,
  },
  {
    id: 4, userId: 'neon', username: 'NeonCoder', initials: 'NC',
    avatarBg: 'linear-gradient(135deg, #00D4DD, #0066FF)',
    photo: 'https://i.pravatar.cc/150?img=11',
    texts: ['Dale, los espero en la sala de voz 🎧'], time: '12:38', isOwn: false,
    reactions: { flame: 1 },
  },
  {
    id: 5, userId: 'pixel', username: 'PixelArtist', initials: 'PA',
    avatarBg: 'linear-gradient(135deg, #FFD740, #FF9100)',
    photo: 'https://i.pravatar.cc/150?img=33',
    texts: ['GG la última partida estuvo brutal 🔥'], time: '12:40', isOwn: false,
    reactions: { flame: 5 },
  },
  {
    id: 6, userId: 'fenix', username: 'FenixUser', initials: 'FU',
    avatarBg: 'linear-gradient(135deg, #FF2DAA, #8A00FF)',
    photo: 'https://i.pravatar.cc/150?img=68',
    texts: ['Ey! Yo quiero jugar también 🙋‍♂️'], time: '12:42', isOwn: true,
    readBy: [
      { initials: 'NC', photo: 'https://i.pravatar.cc/150?img=11' },
      { initials: 'LS', photo: 'https://i.pravatar.cc/150?img=5' },
      { initials: 'DK', photo: 'https://i.pravatar.cc/150?img=12' },
    ],
  },
  {
    id: 7, userId: 'neon', username: 'NeonCoder', initials: 'NC',
    avatarBg: 'linear-gradient(135deg, #00D4DD, #0066FF)',
    photo: 'https://i.pravatar.cc/150?img=11',
    texts: ['Perfecto! Únete a la sala de voz', 'Empezamos en 2 minutos ⚡'], time: '12:43', isOwn: false,
  },
]

/**
 * Mensajes mock — DM
 */
const DM_MESSAGES = {
  'd1': [
    {
      id: 1, userId: 'neon', username: 'NeonCoder', initials: 'NC',
      avatarBg: 'linear-gradient(135deg, #00F5FF, #0066FF)',
      photo: 'https://i.pravatar.cc/150?img=11',
      texts: ['Hey bro, ¿vas a jugar hoy?'], time: '11:20', isOwn: false,
      reactions: { flame: 1 },
    },
    {
      id: 2, userId: 'fenix', username: 'FenixUser', initials: 'FU',
      avatarBg: 'linear-gradient(135deg, #FF2DAA, #8A00FF)',
      photo: 'https://i.pravatar.cc/150?img=68',
      texts: ['Sí! Estoy libre en la tarde', 'A qué hora quedamos?'], time: '11:25', isOwn: true,
      readBy: [
        { initials: 'NC', photo: 'https://i.pravatar.cc/150?img=11' },
      ],
    },
    {
      id: 3, userId: 'neon', username: 'NeonCoder', initials: 'NC',
      avatarBg: 'linear-gradient(135deg, #00F5FF, #0066FF)',
      photo: 'https://i.pravatar.cc/150?img=11',
      texts: ['A las 6 está bien?'], time: '11:30', isOwn: false,
    },
    {
      id: 4, userId: 'fenix', username: 'FenixUser', initials: 'FU',
      avatarBg: 'linear-gradient(135deg, #FF2DAA, #8A00FF)',
      photo: 'https://i.pravatar.cc/150?img=68',
      texts: ['Perfecto! 🔥'], time: '11:32', isOwn: true,
      readBy: [
        { initials: 'NC', photo: 'https://i.pravatar.cc/150?img=11' },
      ],
    },
    {
      id: 5, userId: 'neon', username: 'NeonCoder', initials: 'NC',
      avatarBg: 'linear-gradient(135deg, #00F5FF, #0066FF)',
      photo: 'https://i.pravatar.cc/150?img=11',
      texts: ['Dale bro, nos vemos mañana'], time: '12:45', isOwn: false,
    },
  ],
  'd2': [
    {
      id: 1, userId: 'luna', username: 'Luna_Star', initials: 'LS',
      avatarBg: 'linear-gradient(135deg, #FF2DAA, #FF6B6B)',
      photo: 'https://i.pravatar.cc/150?img=5',
      texts: ['Hola! Mira lo que hice 🎨'], time: '10:00', isOwn: false,
    },
    {
      id: 2, userId: 'fenix', username: 'FenixUser', initials: 'FU',
      avatarBg: 'linear-gradient(135deg, #FF2DAA, #8A00FF)',
      photo: 'https://i.pravatar.cc/150?img=68',
      texts: ['Wow se ve increíble!'], time: '10:15', isOwn: true,
      readBy: [
        { initials: 'LS', photo: 'https://i.pravatar.cc/150?img=5' },
      ],
    },
    {
      id: 3, userId: 'luna', username: 'Luna_Star', initials: 'LS',
      avatarBg: 'linear-gradient(135deg, #FF2DAA, #FF6B6B)',
      photo: 'https://i.pravatar.cc/150?img=5',
      texts: ['Te envié el archivo 📎'], time: '11:30', isOwn: false,
    },
  ],
}

/**
 * ChatView — Vista principal del chat (comunidad o DM)
 */
function ChatView({ itemId, itemType, onBack }) {
  const isCommunity = itemType === 'comunidades'
  const touchStartRef = useRef(null)
  const msgSwipeRef = useRef({})
  const [replyTo, setReplyTo] = useState(null)
  
  // Obtener datos según el tipo
  const data = isCommunity ? COMMUNITY_DATA[itemId] : DM_DATA[itemId]
  if (!data) return null

  // Mensajes según el tipo
  const messages = isCommunity ? COMMUNITY_MESSAGES : (DM_MESSAGES[itemId] || DM_MESSAGES['d1'])

  // Initialize flame reactions from mock data
  const initialReactions = {}
  messages.forEach((msg) => {
    if (msg.reactions && msg.reactions.flame) {
      initialReactions[msg.id] = msg.reactions.flame
    }
  })
  const [reactions, setReactions] = useState(initialReactions)

  // Handle double-click flame reaction
  const handleDoubleClick = (msgId) => {
    setReactions((prev) => ({
      ...prev,
      [msgId]: (prev[msgId] || 0) + 1,
    }))
  }

  // Swipe-left reply handlers
  const handleMsgTouchStart = (e, msg) => {
    msgSwipeRef.current[msg.id] = {
      startX: e.touches[0].clientX,
      el: e.currentTarget,
    }
  }

  const handleMsgTouchMove = (e, msg) => {
    const ref = msgSwipeRef.current[msg.id]
    if (!ref) return
    const deltaX = e.touches[0].clientX - ref.startX
    if (deltaX < -10) {
      const clampedX = Math.max(deltaX, -120)
      ref.el.style.transform = `translateX(${clampedX}px)`
    }
  }

  const handleMsgTouchEnd = (e, msg) => {
    const ref = msgSwipeRef.current[msg.id]
    if (!ref) return
    const endX = e.changedTouches[0].clientX
    const deltaX = endX - ref.startX
    ref.el.style.transform = ''
    if (deltaX < -80) {
      setReplyTo(msg)
    }
    delete msgSwipeRef.current[msg.id]
  }

  // Subtítulo del header
  const subtitle = isCommunity
    ? `${data.members} miembros`
    : (!isCommunity && data.activity)
      ? `${data.activity.emoji} ${data.activity.text}`
      : data.online ? 'En línea' : 'Desconectado'

  // --- Swipe-right para volver (edge swipe desde la izquierda) ---
  const handleTouchStart = (e) => {
    const startX = e.touches[0].clientX
    // Solo registrar si el toque empieza en los primeros 40px (borde izquierdo)
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
    // Si el swipe es mayor a 80px hacia la derecha, volver
    if (deltaX > 80) {
      onBack()
    }
    touchStartRef.current = null
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

        <div
          className="chat-view__header-avatar"
          style={{ background: !isCommunity && data.photo ? 'none' : data.gradient }}
        >
          {isCommunity ? data.emoji : (
            data.photo ? (
              <img src={data.photo} alt={data.name} className="chat-view__header-avatar-img" />
            ) : data.initials
          )}
          {/* Online dot for DMs */}
          {!isCommunity && data.online && (
            <span className="chat-view__header-online-dot" />
          )}
        </div>

        <div className="chat-view__header-info">
          <div className="chat-view__header-name">{data.name}</div>
          <div className={`chat-view__header-subtitle ${!isCommunity && data.activity ? 'chat-view__header-subtitle--activity' : ''} ${!isCommunity && data.online && !data.activity ? 'chat-view__header-subtitle--online' : ''}`}>
            {subtitle}
          </div>
        </div>

        <div className="chat-view__header-actions">
          <button className="chat-view__header-btn" aria-label="Llamar">
            <Phone size={18} />
          </button>
          {isCommunity && (
            <button className="chat-view__header-btn" aria-label="Notificaciones">
              <Bell size={18} />
            </button>
          )}
          <button className="chat-view__header-btn" aria-label="Más opciones">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* --- Voice strip — LLAMATIVO (solo comunidades con voz activa) --- */}
      {isCommunity && data.voiceCount > 0 && (
        <div className="chat-view__voice-strip">
          {/* Barras de onda animadas */}
          <div className="chat-view__voice-waves">
            <span className="chat-view__voice-wave-bar" />
            <span className="chat-view__voice-wave-bar" />
            <span className="chat-view__voice-wave-bar" />
            <span className="chat-view__voice-wave-bar" />
            <span className="chat-view__voice-wave-bar" />
          </div>

          <div className="chat-view__voice-info">
            <span>{data.voiceCount} en sala de voz</span>
            <div className="chat-view__voice-avatars">
              {data.voiceUsers.map((u, i) => (
                <div
                  key={i}
                  className="chat-view__voice-mini-avatar"
                  style={{ background: u.bg }}
                >
                  {u.initials}
                </div>
              ))}
            </div>
          </div>
          <button className="chat-view__voice-join">Unirse</button>
        </div>
      )}

      {/* --- Mensajes --- */}
      <div className="chat-view__messages">
        {messages.map((msg) => {
          const flameCount = reactions[msg.id] || 0
          return (
            <div
              key={msg.id}
              className={`chat-view__msg-group ${msg.isOwn ? 'chat-view__msg-group--own' : ''}`}
              onTouchStart={(e) => handleMsgTouchStart(e, msg)}
              onTouchMove={(e) => handleMsgTouchMove(e, msg)}
              onTouchEnd={(e) => handleMsgTouchEnd(e, msg)}
            >
              {/* Avatar redondo */}
              <div
                className="chat-view__msg-avatar"
                style={{ background: msg.photo ? 'none' : msg.avatarBg }}
              >
                {msg.photo ? (
                  <img src={msg.photo} alt={msg.username} className="chat-view__msg-avatar-img" />
                ) : (
                  msg.initials
                )}
              </div>

              {/* Cuerpo del mensaje */}
              <div className="chat-view__msg-body">
                <div className="chat-view__msg-header">
                  <span className="chat-view__msg-username">{msg.username}</span>
                  <span className="chat-view__msg-time">{msg.time}</span>
                </div>
                {msg.texts.map((text, i) => (
                  <div
                    key={i}
                    className="chat-view__msg-text"
                    onDoubleClick={() => handleDoubleClick(msg.id)}
                  >
                    {text}
                  </div>
                ))}

                {/* Flame reactions */}
                {flameCount > 0 && (
                  <div className="chat-view__reactions">
                    <button
                      className="chat-view__reaction chat-view__reaction--active"
                      onClick={() => handleDoubleClick(msg.id)}
                    >
                      <Flame size={14} className="chat-view__reaction-flame" />
                      <span>{flameCount}</span>
                    </button>
                  </div>
                )}

                {/* Read receipts — only for own messages */}
                {msg.isOwn && msg.readBy && msg.readBy.length > 0 && (
                  <div className="chat-view__read-receipts">
                    {msg.readBy.map((reader, i) => (
                      <img
                        key={i}
                        src={reader.photo}
                        alt={reader.initials}
                        className="chat-view__read-avatar"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Indicador de escritura — solo DMs */}
        {!isCommunity && (
          <div className="chat-view__typing-indicator">
            <div
              className="chat-view__msg-avatar chat-view__msg-avatar--typing"
              style={{ background: data.photo ? 'none' : data.gradient }}
            >
              {data.photo ? (
                <img src={data.photo} alt={data.name} className="chat-view__msg-avatar-img" />
              ) : (
                data.initials
              )}
            </div>
            <div className="chat-view__typing-bubble">
              <span className="chat-view__typing-dot" />
              <span className="chat-view__typing-dot" />
              <span className="chat-view__typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* --- Reply preview bar --- */}
      {replyTo && (
        <div className="chat-view__reply-bar">
          <Reply size={16} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
          <div className="chat-view__reply-info">
            <div className="chat-view__reply-name">{replyTo.username}</div>
            <div className="chat-view__reply-text">{replyTo.texts[0]}</div>
          </div>
          <button
            className="chat-view__reply-close"
            onClick={() => setReplyTo(null)}
            aria-label="Cerrar respuesta"
          >
            <X size={16} />
          </button>
        </div>
      )}

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
          />
          <button className="chat-view__input-btn" aria-label="Adjuntar">
            <Paperclip size={18} />
          </button>
          <button className="chat-view__input-btn" aria-label="Mensaje de voz">
            <Mic size={18} />
          </button>
        </div>
        <button className="chat-view__send-btn" aria-label="Enviar">
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}

export default ChatView
