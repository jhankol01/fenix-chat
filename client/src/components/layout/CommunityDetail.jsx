import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Hash, Volume2, Send, Users, Crown, Shield, Settings, Copy, Check, Plus, Megaphone } from 'lucide-react'
import api from '../../lib/api'
import { getSocket } from '../../lib/socket'
import useAuthStore from '../../stores/authStore'
import './CommunityDetail.css'

const CHANNEL_ICONS = {
  text: Hash,
  announcements: Megaphone,
  vip: Crown,
}

function CommunityDetail({ community: initialCommunity, onBack }) {
  const [community, setCommunity] = useState(initialCommunity)
  const [activeTab, setActiveTab] = useState('chat')
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef(null)
  const user = useAuthStore(s => s.user)

  // Load community detail
  useEffect(() => {
    if (!initialCommunity?.id) return
    api.get(`/communities/${initialCommunity.id}`).then(data => {
      if (data.community) {
        setCommunity(data.community)
        // Auto-select first text channel
        const firstChannel = data.community.channels?.find(c => c.type === 'text') || data.community.channels?.[0]
        if (firstChannel) setActiveChannel(firstChannel)
      }
    }).catch(console.error)
  }, [initialCommunity?.id])

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannel?.id) return
    api.get(`/communities/${community.id}/channels/${activeChannel.id}/messages`)
      .then(data => setMessages(data.messages || []))
      .catch(console.error)

    // Join socket room
    const socket = getSocket()
    if (socket) {
      socket.emit('join_channel', { channelId: activeChannel.id })
      const handler = (msg) => {
        if (msg.channel_id === activeChannel.id) {
          setMessages(prev => [...prev, msg])
        }
      }
      socket.on('channel_message', handler)
      return () => {
        socket.emit('leave_channel', { channelId: activeChannel.id })
        socket.off('channel_message', handler)
      }
    }
  }, [activeChannel?.id])

  // Load members
  useEffect(() => {
    if (activeTab === 'members' && community?.id) {
      api.get(`/communities/${community.id}/members`)
        .then(data => setMembers(data.members || []))
        .catch(console.error)
    }
  }, [activeTab, community?.id])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!newMsg.trim() || !activeChannel?.id) return
    const socket = getSocket()
    if (socket) {
      socket.emit('channel_message', {
        channelId: activeChannel.id,
        content: newMsg.trim(),
        type: 'text',
      })
    }
    setNewMsg('')
  }

  const copyInvite = () => {
    if (community?.invite_code) {
      navigator.clipboard.writeText(community.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const roleIcon = (role) => {
    if (role === 'owner') return <Crown size={13} className="role-icon role-icon--owner" />
    if (role === 'admin') return <Shield size={13} className="role-icon role-icon--admin" />
    return null
  }

  if (!community) return null

  return (
    <div className="community-detail">
      {/* Header */}
      <div className="community-detail__header">
        <div className="community-detail__header-banner">
          {community.banner_url ? (
            <img src={community.banner_url} alt="" />
          ) : (
            <div className="community-detail__header-gradient" />
          )}
          <div className="community-detail__header-overlay">
            <button className="community-detail__back" onClick={onBack}>
              <ArrowLeft size={20} />
            </button>
            <div className="community-detail__header-info">
              <h2>{community.name}</h2>
              <span>{community.member_count} miembros</span>
            </div>
            <button className="community-detail__invite" onClick={copyInvite}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copiado' : 'Invitar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="community-detail__tabs">
        {['chat', 'voice', 'members'].map(t => (
          <button
            key={t}
            className={`community-detail__tab ${activeTab === t ? 'community-detail__tab--active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t === 'chat' && '💬 Chat'}
            {t === 'voice' && '🎙️ Voz'}
            {t === 'members' && `👥 ${community.member_count || ''}`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="community-detail__content">
        {/* ─── Chat Tab ─── */}
        {activeTab === 'chat' && (
          <div className="community-detail__chat-layout">
            {/* Channel sidebar */}
            <div className="community-detail__channels">
              <div className="community-detail__channels-title">Canales</div>
              {community.channels?.map(ch => {
                const Icon = CHANNEL_ICONS[ch.type] || Hash
                return (
                  <button
                    key={ch.id}
                    className={`community-detail__channel ${activeChannel?.id === ch.id ? 'community-detail__channel--active' : ''}`}
                    onClick={() => setActiveChannel(ch)}
                  >
                    <Icon size={15} />
                    <span>{ch.name}</span>
                  </button>
                )
              })}
            </div>

            {/* Messages */}
            <div className="community-detail__messages-area">
              <div className="community-detail__messages-header">
                <Hash size={16} /> {activeChannel?.name || 'chat-general'}
              </div>
              <div className="community-detail__messages">
                {messages.length === 0 ? (
                  <div className="community-detail__empty-chat">
                    <p>Sé el primero en enviar un mensaje 🔥</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`community-detail__msg ${msg.user_id === user?.id ? 'community-detail__msg--own' : ''}`}>
                      {msg.user_id !== user?.id && (
                        <div className="community-detail__msg-avatar">
                          {msg.avatar_url ? (
                            <img src={msg.avatar_url} alt="" />
                          ) : (
                            <span>{msg.username?.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                      )}
                      <div className="community-detail__msg-body">
                        {msg.user_id !== user?.id && (
                          <span className="community-detail__msg-name">{msg.display_name || msg.username}</span>
                        )}
                        <div className="community-detail__msg-bubble">
                          {msg.content}
                        </div>
                        <span className="community-detail__msg-time">
                          {new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="community-detail__input-bar">
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                  placeholder={`Mensaje en #${activeChannel?.name || 'chat-general'}`}
                  className="community-detail__input"
                />
                {newMsg.trim() && (
                  <button className="community-detail__send" onClick={handleSend}>
                    <Send size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Voice Tab ─── */}
        {activeTab === 'voice' && (
          <div className="community-detail__voice">
            {community.voice_rooms?.map(room => (
              <div key={room.id} className="community-detail__voice-room">
                <div className="community-detail__voice-room-info">
                  <Volume2 size={20} />
                  <div>
                    <h4>{room.name}</h4>
                    <span>{room.participant_count || 0} conectados</span>
                  </div>
                </div>
                <button className="community-detail__voice-join">
                  Entrar
                </button>
              </div>
            ))}
            {(!community.voice_rooms || community.voice_rooms.length === 0) && (
              <div className="community-detail__empty-chat">
                <Volume2 size={48} strokeWidth={1} />
                <p>No hay salas de voz</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Members Tab ─── */}
        {activeTab === 'members' && (
          <div className="community-detail__members">
            {members.map(m => (
              <div key={m.id} className="community-detail__member">
                <div className="community-detail__member-avatar">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" />
                  ) : (
                    <span>{m.username?.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="community-detail__member-info">
                  <span className="community-detail__member-name">
                    {roleIcon(m.role)} {m.display_name || m.username}
                  </span>
                  <span className="community-detail__member-role">{m.role}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CommunityDetail
