import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Hash, Volume2, Send, Users, Crown, Shield, Settings, Copy, Check, Plus, Megaphone, Mic, MicOff, PhoneOff, UserPlus } from 'lucide-react'
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
  // Voice state
  const [inVoiceRoom, setInVoiceRoom] = useState(null)
  const [voiceParticipants, setVoiceParticipants] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const localStreamRef = useRef(null)
  const peerConnectionsRef = useRef({})
  const audioElementsRef = useRef({})
  const messagesEndRef = useRef(null)
  const user = useAuthStore(s => s.user)

  // Load community detail
  useEffect(() => {
    if (!initialCommunity?.id) return
    api.get(`/communities/${initialCommunity.id}`).then(data => {
      if (data.community) {
        setCommunity(data.community)
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

  // ─── Voice Room Socket Events ────────────────────────────────
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onUserJoined = (data) => {
      setVoiceParticipants(prev => {
        if (prev.find(p => p.userId === data.userId)) return prev
        return [...prev, data]
      })
    }

    const onUserLeft = (data) => {
      setVoiceParticipants(prev => prev.filter(p => p.userId !== data.userId))
      if (peerConnectionsRef.current[data.userId]) {
        peerConnectionsRef.current[data.userId].close()
        delete peerConnectionsRef.current[data.userId]
      }
      if (audioElementsRef.current[data.userId]) {
        audioElementsRef.current[data.userId].remove()
        delete audioElementsRef.current[data.userId]
      }
    }

    const onVoiceOffer = async ({ from, offer }) => {
      if (!localStreamRef.current) return
      const pc = createPeerConnection(from)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('voice_answer', { to: from, answer })
    }

    const onVoiceAnswer = async ({ from, answer }) => {
      const pc = peerConnectionsRef.current[from]
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer))
    }

    const onVoiceIce = async ({ from, candidate }) => {
      const pc = peerConnectionsRef.current[from]
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      }
    }

    socket.on('voice_user_joined', onUserJoined)
    socket.on('voice_user_left', onUserLeft)
    socket.on('voice_offer', onVoiceOffer)
    socket.on('voice_answer', onVoiceAnswer)
    socket.on('voice_ice', onVoiceIce)

    return () => {
      socket.off('voice_user_joined', onUserJoined)
      socket.off('voice_user_left', onUserLeft)
      socket.off('voice_offer', onVoiceOffer)
      socket.off('voice_answer', onVoiceAnswer)
      socket.off('voice_ice', onVoiceIce)
    }
  }, [inVoiceRoom, user?.id])

  const createPeerConnection = useCallback((remoteUserId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })
    peerConnectionsRef.current[remoteUserId] = pc

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    pc.ontrack = (e) => {
      let audio = audioElementsRef.current[remoteUserId]
      if (!audio) {
        audio = new Audio()
        audio.autoplay = true
        audioElementsRef.current[remoteUserId] = audio
      }
      audio.srcObject = e.streams[0]
    }

    const socket = getSocket()
    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('voice_ice', { to: remoteUserId, candidate: e.candidate })
      }
    }

    return pc
  }, [])

  const createOffer = useCallback(async (remoteUserId, socket) => {
    const pc = createPeerConnection(remoteUserId)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socket.emit('voice_offer', { to: remoteUserId, offer })
  }, [createPeerConnection])

  // Join voice room
  const joinVoiceRoom = async (roomId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      setInVoiceRoom(roomId)
      setIsMuted(false)

      const socket = getSocket()
      if (socket) socket.emit('join_voice_room', { roomId })

      setVoiceParticipants(prev => {
        if (prev.find(p => p.userId === user?.id)) return prev
        return [...prev, { userId: user.id, username: user.username, display_name: user.display_name, avatar_url: user.avatar_url }]
      })
    } catch (err) {
      console.error('Mic error:', err)
      alert('No se pudo acceder al micrófono')
    }
  }

  // Leave voice room
  const leaveVoiceRoom = () => {
    const socket = getSocket()
    if (socket && inVoiceRoom) socket.emit('leave_voice_room', { roomId: inVoiceRoom })

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close())
    peerConnectionsRef.current = {}
    Object.values(audioElementsRef.current).forEach(a => { try { a.remove() } catch(e){} })
    audioElementsRef.current = {}
    setInVoiceRoom(null)
    setVoiceParticipants([])
  }

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted })
      setIsMuted(!isMuted)
    }
  }

  // Cleanup on unmount
  useEffect(() => { return () => { if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()) } } }, [])

  const handleSend = () => {
    if (!newMsg.trim() || !activeChannel?.id) return
    const socket = getSocket()
    if (socket) {
      socket.emit('channel_message', { channelId: activeChannel.id, content: newMsg.trim(), type: 'text' })
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
            <button className="community-detail__back" onClick={() => { leaveVoiceRoom(); onBack(); }}>
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
          <button key={t}
            className={`community-detail__tab ${activeTab === t ? 'community-detail__tab--active' : ''}`}
            onClick={() => setActiveTab(t)}>
            {t === 'chat' && '💬 Chat'}
            {t === 'voice' && <>🎙️ Voz {inVoiceRoom && <span className="voice-live-dot" />}</>}
            {t === 'members' && `👥 ${community.member_count || ''}`}
          </button>
        ))}
      </div>

      {/* Voice strip when in room but not on voice tab */}
      {inVoiceRoom && activeTab !== 'voice' && (
        <div className="community-detail__voice-strip" onClick={() => setActiveTab('voice')}>
          <Volume2 size={16} />
          <span>En voz · {voiceParticipants.length} conectados</span>
          <button className="community-detail__voice-strip-leave" onClick={(e) => { e.stopPropagation(); leaveVoiceRoom(); }}>
            <PhoneOff size={14} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="community-detail__content">
        {/* ─── Chat Tab ─── */}
        {activeTab === 'chat' && (
          <div className="community-detail__chat-layout">
            <div className="community-detail__channels">
              <div className="community-detail__channels-title">Canales</div>
              {community.channels?.map(ch => {
                const Icon = CHANNEL_ICONS[ch.type] || Hash
                return (
                  <button key={ch.id}
                    className={`community-detail__channel ${activeChannel?.id === ch.id ? 'community-detail__channel--active' : ''}`}
                    onClick={() => setActiveChannel(ch)}>
                    <Icon size={15} /><span>{ch.name}</span>
                  </button>
                )
              })}
            </div>

            <div className="community-detail__messages-area">
              <div className="community-detail__messages-header">
                <Hash size={16} /> {activeChannel?.name || 'chat-general'}
              </div>
              <div className="community-detail__messages">
                {messages.length === 0 ? (
                  <div className="community-detail__empty-chat"><p>Sé el primero en enviar un mensaje 🔥</p></div>
                ) : messages.map(msg => (
                  <div key={msg.id} className={`community-detail__msg ${msg.user_id === user?.id ? 'community-detail__msg--own' : ''}`}>
                    {msg.user_id !== user?.id && (
                      <div className="community-detail__msg-avatar">
                        {msg.avatar_url ? <img src={msg.avatar_url} alt="" /> : <span>{msg.username?.slice(0, 2).toUpperCase()}</span>}
                      </div>
                    )}
                    <div className="community-detail__msg-body">
                      {msg.user_id !== user?.id && <span className="community-detail__msg-name">{msg.display_name || msg.username}</span>}
                      <div className="community-detail__msg-bubble">{msg.content}</div>
                      <span className="community-detail__msg-time">{new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="community-detail__input-bar">
                <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                  placeholder={`Mensaje en #${activeChannel?.name || 'chat-general'}`}
                  className="community-detail__input" />
                {newMsg.trim() && <button className="community-detail__send" onClick={handleSend}><Send size={18} /></button>}
              </div>
            </div>
          </div>
        )}

        {/* ─── Voice Tab ─── */}
        {activeTab === 'voice' && (
          <div className="community-detail__voice">
            {community.voice_rooms?.map(room => {
              const isInThisRoom = inVoiceRoom === room.id
              return (
                <div key={room.id} className={`community-detail__voice-room ${isInThisRoom ? 'community-detail__voice-room--active' : ''}`}>
                  <div className="community-detail__voice-room-header">
                    <div className="community-detail__voice-room-info">
                      <Volume2 size={20} />
                      <div>
                        <h4>{room.name}</h4>
                        <span>
                          {isInThisRoom ? voiceParticipants.length : (room.participant_count || 0)} conectados
                          {isInThisRoom && <span className="voice-live-badge">EN VIVO</span>}
                        </span>
                      </div>
                    </div>
                    {!isInThisRoom ? (
                      <button className="community-detail__voice-join" onClick={() => joinVoiceRoom(room.id)}>Entrar</button>
                    ) : (
                      <button className="community-detail__voice-leave" onClick={leaveVoiceRoom}>
                        <PhoneOff size={16} /> Salir
                      </button>
                    )}
                  </div>

                  {isInThisRoom && (
                    <>
                      <div className="community-detail__voice-participants">
                        {voiceParticipants.map(p => (
                          <div key={p.userId} className={`voice-participant ${p.userId === user?.id && isMuted ? 'voice-participant--muted' : ''}`}>
                            <div className="voice-participant__avatar">
                              {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{(p.username || '??').slice(0, 2).toUpperCase()}</span>}
                              {p.userId === user?.id && isMuted && <div className="voice-participant__muted-icon"><MicOff size={12} /></div>}
                            </div>
                            <span className="voice-participant__name">{p.userId === user?.id ? 'Tú' : (p.display_name || p.username)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="community-detail__voice-controls">
                        <button className={`voice-control ${isMuted ? 'voice-control--danger' : ''}`} onClick={toggleMute}>
                          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                          <span>{isMuted ? 'Silenciado' : 'Micrófono'}</span>
                        </button>
                        <button className="voice-control voice-control--danger" onClick={leaveVoiceRoom}>
                          <PhoneOff size={20} /><span>Salir</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ─── Members Tab ─── */}
        {activeTab === 'members' && (
          <div className="community-detail__members">
            {members.map(m => (
              <div key={m.id} className="community-detail__member">
                <div className="community-detail__member-avatar">
                  {m.avatar_url ? <img src={m.avatar_url} alt="" /> : <span>{m.username?.slice(0, 2).toUpperCase()}</span>}
                </div>
                <div className="community-detail__member-info">
                  <span className="community-detail__member-name">{roleIcon(m.role)} {m.display_name || m.username}</span>
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
