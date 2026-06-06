import { useState } from 'react'
import { Flame, Search, Plus, Settings, Users, MessageCircle, Volume2 } from 'lucide-react'
import './ChatList.css'

/**
 * Datos mock de comunidades
 */
const MOCK_COMMUNITIES = [
  {
    id: 'c1',
    name: 'Gamers Zone',
    emoji: '🎮',
    gradient: 'linear-gradient(135deg, #00D4DD, #0066FF)',
    lastMessage: 'NeonCoder: gg ez!',
    time: 'Ayer',
    unread: 3,
    voiceCount: 3,
    voiceUsers: [
      { name: 'NeonCoder', initials: 'NC', gradient: 'linear-gradient(135deg, #00D4DD, #0066FF)', photo: 'https://i.pravatar.cc/150?img=11' },
      { name: 'Luna_Star', initials: 'LS', gradient: 'linear-gradient(135deg, #FF2DAA, #8A00FF)', photo: 'https://i.pravatar.cc/150?img=5' },
      { name: 'DarkKnight', initials: 'DK', gradient: 'linear-gradient(135deg, #8A00FF, #5500cc)', photo: 'https://i.pravatar.cc/150?img=12' },
    ],
  },
  {
    id: 'c2',
    name: 'Design Team',
    emoji: '🎨',
    gradient: 'linear-gradient(135deg, #FF2DAA, #8A00FF)',
    lastMessage: 'Luna: miren el nuevo diseño',
    time: '2h',
    unread: 0,
    voiceCount: 0,
  },
  {
    id: 'c3',
    name: 'Music Lovers',
    emoji: '🎵',
    gradient: 'linear-gradient(135deg, #00E676, #00B8D4)',
    lastMessage: null,
    voiceLabel: '🎙 2 en sala de voz',
    time: '5h',
    unread: 1,
    voiceCount: 2,
    voiceUsers: [
      { name: 'PixelArtist', initials: 'PA', gradient: 'linear-gradient(135deg, #FFD740, #FF9100)', photo: 'https://i.pravatar.cc/150?img=33' },
      { name: 'Crystal_Wave', initials: 'CW', gradient: 'linear-gradient(135deg, #00E676, #00B8D4)', photo: 'https://i.pravatar.cc/150?img=23' },
    ],
  },
  {
    id: 'c4',
    name: 'Code Academy',
    emoji: '💻',
    gradient: 'linear-gradient(135deg, #8A00FF, #FF2DAA)',
    lastMessage: 'ByteStorm: alguien sabe React?',
    time: 'Ayer',
    unread: 0,
    voiceCount: 0,
  },
]

/**
 * Datos mock de chats directos (DMs)
 */
const MOCK_DMS = [
  {
    id: 'd1',
    name: 'NeonCoder',
    initials: 'NC',
    gradient: 'linear-gradient(135deg, #00F5FF, #0066FF)',
    photo: 'https://i.pravatar.cc/150?img=11',
    lastMessage: 'Dale bro, nos vemos mañana',
    time: '12:45',
    unread: 2,
    online: true,
    typing: true,
    activity: { emoji: '🎮', text: 'Jugando Valorant' },
  },
  {
    id: 'd2',
    name: 'Luna_Star',
    initials: 'LS',
    gradient: 'linear-gradient(135deg, #FF2DAA, #FF6B6B)',
    photo: 'https://i.pravatar.cc/150?img=5',
    lastMessage: 'Te envié el archivo 📎',
    time: '11:30',
    unread: 0,
    online: true,
    typing: true,
    activity: { emoji: '🎨', text: 'Diseñando' },
  },
  {
    id: 'd3',
    name: 'DarkKnight',
    initials: 'DK',
    gradient: 'linear-gradient(135deg, #8A00FF, #4A00B4)',
    photo: 'https://i.pravatar.cc/150?img=12',
    lastMessage: 'Buena partida! 🔥',
    time: 'Ayer',
    unread: 0,
    online: false,
  },
  {
    id: 'd4',
    name: 'PixelArtist',
    initials: 'PA',
    gradient: 'linear-gradient(135deg, #FF6B35, #FFD740)',
    photo: 'https://i.pravatar.cc/150?img=33',
    lastMessage: 'Mira este diseño que hice',
    time: 'Ayer',
    unread: 1,
    online: false,
  },
  {
    id: 'd5',
    name: 'ByteStorm',
    initials: 'BS',
    gradient: 'linear-gradient(135deg, #00E676, #00B8D4)',
    photo: 'https://i.pravatar.cc/150?img=59',
    lastMessage: 'Gracias por la ayuda! 🙏',
    time: 'Lun',
    unread: 0,
    online: true,
    activity: { emoji: '💻', text: 'Programando' },
  },
]

/**
 * ChatList — Panel izquierdo con dos secciones:
 * - Chats (mensajes directos 1-a-1)
 * - Comunidades (grupos)
 *
 * Props:
 *  - section (opcional): 'chats' | 'comunidades'
 *    Cuando se provee (mobile), se filtra a esa sección
 *    y se ocultan los tabs internos.
 *    Cuando no se provee (desktop), se muestran los tabs
 *    internos para cambiar entre secciones.
 */
function ChatList({ activeItemId, onSelectItem, section }) {
  const [internalSection, setInternalSection] = useState('chats') // 'chats' o 'comunidades'
  const [searchQuery, setSearchQuery] = useState('')

  // Determinar la sección activa: prop externa (mobile) o interna (desktop)
  const currentSection = section || internalSection
  // ¿Mostrar tabs internos? Solo si no se provee prop section (modo desktop)
  const showInternalTabs = !section

  const items = currentSection === 'chats' ? MOCK_DMS : MOCK_COMMUNITIES

  // Placeholder de búsqueda según sección
  const searchPlaceholder = currentSection === 'chats' ? 'Buscar chat...' : 'Buscar comunidad...'

  // Título del header según modo
  const headerTitle = section
    ? (section === 'chats' ? 'Chats' : 'Comunidades')
    : 'Fénix Chat'

  // Filtrar por búsqueda
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="chat-list">
      {/* Header */}
      <div className="chat-list__header">
        <div className="chat-list__logo">
          {/* Solo mostrar el ícono de llama en modo desktop */}
          {!section && (
            <Flame size={24} className="chat-list__logo-icon" />
          )}
          <span className="chat-list__logo-text">{headerTitle}</span>
        </div>
        <button className="chat-list__new-btn" aria-label="Nuevo">
          <Plus size={20} />
        </button>
      </div>

      {/* Tabs internos: solo en modo desktop (sin prop section) */}
      {showInternalTabs && (
        <div className="chat-list__tabs">
          <button
            className={`chat-list__tab ${internalSection === 'chats' ? 'chat-list__tab--active' : ''}`}
            onClick={() => { setInternalSection('chats'); setSearchQuery('') }}
          >
            <MessageCircle size={16} />
            <span>Chats</span>
          </button>
          <button
            className={`chat-list__tab ${internalSection === 'comunidades' ? 'chat-list__tab--active' : ''}`}
            onClick={() => { setInternalSection('comunidades'); setSearchQuery('') }}
          >
            <Users size={16} />
            <span>Comunidades</span>
          </button>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="chat-list__search">
        <div className="chat-list__search-bar">
          <Search size={16} className="chat-list__search-icon" />
          <input
            type="text"
            className="chat-list__search-input"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Lista de items */}
      <div className="chat-list__items">
        {filteredItems.map((item) => {
          const isActive = activeItemId === item.id
          const hasUnread = item.unread > 0
          const itemClasses = [
            'chat-list__item',
            isActive && 'chat-list__item--active',
            hasUnread && 'chat-list__item--unread',
          ].filter(Boolean).join(' ')

          // Preview: voz activa, o último mensaje
          const previewText = item.voiceLabel || item.lastMessage || ''

          // El avatar depende de la sección
          const isDM = currentSection === 'chats'

          const hasVoice = !isDM && item.voiceUsers && item.voiceUsers.length > 0

          return (
            <div key={item.id} className="chat-list__item-wrapper">
              <div
                className={itemClasses}
                onClick={() => onSelectItem(item.id, currentSection)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectItem(item.id, currentSection)}
              >
                {/* Avatar redondo */}
                <div
                  className={`chat-list__avatar ${item.typing ? 'chat-list__avatar--typing' : ''}`}
                  style={{ background: isDM ? 'none' : item.gradient }}
                >
                  {isDM && item.photo ? (
                    <img src={item.photo} alt={item.name} className="chat-list__avatar-img" />
                  ) : (
                    isDM ? item.initials : item.emoji
                  )}
                  {/* Punto de estado */}
                  {isDM && item.online && (
                    <span className="chat-list__avatar-status chat-list__avatar-status--online" />
                  )}
                  {!isDM && item.voiceCount > 0 && (
                    <span className="chat-list__avatar-status chat-list__avatar-status--voice" />
                  )}
                </div>

                {/* Contenido */}
                <div className="chat-list__item-content">
                  <div className="chat-list__item-top">
                    <span className="chat-list__item-name">{item.name}</span>
                    <span className="chat-list__item-time">{item.time}</span>
                  </div>
                  <div className="chat-list__item-bottom">
                    {item.typing ? (
                      <span className="chat-list__item-typing">
                        escribiendo<span className="chat-list__typing-dots"><span>.</span><span>.</span><span>.</span></span>
                      </span>
                    ) : item.activity ? (
                      <span className="chat-list__item-activity">
                        {item.activity.emoji} {item.activity.text}
                      </span>
                    ) : (
                      <span className="chat-list__item-preview">{previewText}</span>
                    )}
                    {hasUnread && (
                      <span className="chat-list__unread-badge">
                        <Flame size={12} />
                        <span>{item.unread}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Participantes en voz — desplegado debajo del item */}
              {hasVoice && (
                <div className="chat-list__voice-panel">
                  <div className="chat-list__voice-header">
                    <Volume2 size={14} className="chat-list__voice-icon" />
                    <span>Sala de voz</span>
                  </div>
                  {item.voiceUsers.map((user, i) => (
                    <div key={i} className="chat-list__voice-user">
                      <div
                        className="chat-list__voice-user-avatar"
                        style={{ background: user.photo ? 'none' : user.gradient }}
                      >
                        {user.photo ? (
                          <img src={user.photo} alt={user.name} className="chat-list__voice-user-img" />
                        ) : (
                          user.initials
                        )}
                      </div>
                      <span className="chat-list__voice-user-name">{user.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Barra de usuario (abajo) — solo en modo desktop */}
      {!section && (
        <div className="chat-list__user-bar">
          <div className="chat-list__user-avatar">
            FU
            <span className="chat-list__user-online-dot" />
          </div>
          <div className="chat-list__user-info">
            <div className="chat-list__user-name">FenixUser</div>
            <div className="chat-list__user-status">En línea</div>
          </div>
          <button className="chat-list__settings-btn" aria-label="Configuración">
            <Settings size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

export default ChatList
