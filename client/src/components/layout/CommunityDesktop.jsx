import { useState, useEffect, useRef, useCallback } from 'react'
import { Hash, Volume2, Send, Crown, Shield, Megaphone, Mic, MicOff, PhoneOff, Copy, Check, Plus, Users, Settings, Calendar, Bell, Star, ChevronRight, Camera, Loader2 } from 'lucide-react'
import api from '../../lib/api'
import { getSocket } from '../../lib/socket'
import useAuthStore from '../../stores/authStore'
import './CommunityDesktop.css'

function CommunityDesktop({ community: initialCommunity, onBack }) {
  const [community, setCommunity] = useState(initialCommunity)
  const [activeTab, setActiveTab] = useState('chat')
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [copied, setCopied] = useState(false)
  // Voice
  const [inVoiceRoom, setInVoiceRoom] = useState(null)
  const [voiceParticipants, setVoiceParticipants] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const localStreamRef = useRef(null)
  const peerConnectionsRef = useRef({})
  const audioElementsRef = useRef({})
  const inVoiceRoomRef = useRef(null)
  const messagesEndRef = useRef(null)
  const bannerInputRef = useRef(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const user = useAuthStore(s => s.user)

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !community?.id) return
    setUploadingBanner(true)
    try {
      const formData = new FormData()
      formData.append('banner', file)
      formData.append('communityId', community.id)
      const data = await api.upload('/upload/community-banner', formData)
      if (data.bannerUrl) {
        setCommunity(prev => ({ ...prev, banner_url: data.bannerUrl }))
      }
    } catch (err) {
      console.error('Banner upload error:', err)
      alert('Error al subir la portada: ' + (err.message || 'Intenta de nuevo'))
    }
    setUploadingBanner(false)
    if (bannerInputRef.current) bannerInputRef.current.value = ''
  }

  // Load community
  useEffect(() => {
    if (!initialCommunity?.id) return
    api.get(`/communities/${initialCommunity.id}`).then(data => {
      if (data.community) {
        setCommunity(data.community)
        const first = data.community.channels?.find(c => c.type === 'text') || data.community.channels?.[0]
        if (first) setActiveChannel(first)
      }
    }).catch(console.error)
  }, [initialCommunity?.id])

  // Load messages
  useEffect(() => {
    if (!activeChannel?.id) return
    api.get(`/communities/${community.id}/channels/${activeChannel.id}/messages`)
      .then(data => setMessages(data.messages || []))
      .catch(console.error)
    const socket = getSocket()
    if (socket) {
      socket.emit('join_channel', { channelId: activeChannel.id })
      const handler = (msg) => {
        if (msg.channel_id === activeChannel.id) setMessages(prev => [...prev, msg])
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
    if (community?.id) {
      api.get(`/communities/${community.id}/members`)
        .then(data => setMembers(data.members || []))
        .catch(console.error)
    }
  }, [community?.id])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ─── WebRTC Voice ─────────────────────────────────────────
  const createPeerConnection = useCallback((remoteUserId) => {
    if (peerConnectionsRef.current[remoteUserId]) peerConnectionsRef.current[remoteUserId].close()
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] })
    peerConnectionsRef.current[remoteUserId] = pc
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current))
    pc.ontrack = (e) => {
      let audio = audioElementsRef.current[remoteUserId]
      if (!audio) { audio = new Audio(); audio.autoplay = true; audioElementsRef.current[remoteUserId] = audio }
      audio.srcObject = e.streams[0]; audio.play().catch(() => {})
    }
    const socket = getSocket()
    pc.onicecandidate = (e) => { if (e.candidate && socket) socket.emit('voice_ice', { to: remoteUserId, candidate: e.candidate }) }
    return pc
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onRoomUsers = async ({ users }) => {
      if (!localStreamRef.current || !users?.length) return
      setVoiceParticipants(prev => { const nl = [...prev]; for (const u of users) { if (!nl.find(p => p.userId === u.userId)) nl.push(u) }; return nl })
      for (const u of users) {
        if (u.userId !== user?.id) {
          try { const pc = createPeerConnection(u.userId); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit('voice_offer', { to: u.userId, offer }) } catch (e) { console.error(e) }
        }
      }
    }
    const onUserJoined = (d) => { setVoiceParticipants(prev => prev.find(p => p.userId === d.userId) ? prev : [...prev, d]) }
    const onUserLeft = (d) => {
      setVoiceParticipants(prev => prev.filter(p => p.userId !== d.userId))
      if (peerConnectionsRef.current[d.userId]) { peerConnectionsRef.current[d.userId].close(); delete peerConnectionsRef.current[d.userId] }
      if (audioElementsRef.current[d.userId]) { audioElementsRef.current[d.userId].srcObject = null; delete audioElementsRef.current[d.userId] }
    }
    const onOffer = async ({ from, offer }) => {
      if (!localStreamRef.current) return
      try { const pc = createPeerConnection(from); await pc.setRemoteDescription(new RTCSessionDescription(offer)); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); socket.emit('voice_answer', { to: from, answer }) } catch (e) { console.error(e) }
    }
    const onAnswer = async ({ from, answer }) => { const pc = peerConnectionsRef.current[from]; if (pc) try { await pc.setRemoteDescription(new RTCSessionDescription(answer)) } catch(e){} }
    const onIce = async ({ from, candidate }) => { const pc = peerConnectionsRef.current[from]; if (pc && candidate) try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch(e){} }
    socket.on('voice_room_users', onRoomUsers); socket.on('voice_user_joined', onUserJoined); socket.on('voice_user_left', onUserLeft)
    socket.on('voice_offer', onOffer); socket.on('voice_answer', onAnswer); socket.on('voice_ice', onIce)
    return () => { socket.off('voice_room_users', onRoomUsers); socket.off('voice_user_joined', onUserJoined); socket.off('voice_user_left', onUserLeft); socket.off('voice_offer', onOffer); socket.off('voice_answer', onAnswer); socket.off('voice_ice', onIce) }
  }, [user?.id, createPeerConnection])

  const joinVoiceRoom = async (roomId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream; inVoiceRoomRef.current = roomId; setInVoiceRoom(roomId); setIsMuted(false)
      setVoiceParticipants([{ userId: user.id, username: user.username, display_name: user.display_name, avatar_url: user.avatar_url }])
      const socket = getSocket(); if (socket) socket.emit('join_voice_room', { roomId })
    } catch (e) { alert('No se pudo acceder al micrófono') }
  }
  const leaveVoiceRoom = () => {
    const socket = getSocket(); const rid = inVoiceRoomRef.current
    if (socket && rid) socket.emit('leave_voice_room', { roomId: rid })
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null }
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close()); peerConnectionsRef.current = {}
    Object.values(audioElementsRef.current).forEach(a => { try { a.srcObject = null } catch(e){} }); audioElementsRef.current = {}
    inVoiceRoomRef.current = null; setInVoiceRoom(null); setVoiceParticipants([])
  }
  const toggleMute = () => { if (localStreamRef.current) { localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted }); setIsMuted(!isMuted) } }
  useEffect(() => { return () => { if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop()) } }, [])

  const handleSend = () => {
    if (!newMsg.trim() || !activeChannel?.id) return
    const socket = getSocket()
    if (socket) socket.emit('channel_message', { channelId: activeChannel.id, content: newMsg.trim(), type: 'text' })
    setNewMsg('')
  }

  const copyInvite = () => {
    if (community?.invite_code) { navigator.clipboard.writeText(community.invite_code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  if (!community) return null

  const onlineMembers = members.filter(m => m.status === 'online').length

  return (
    <div className="cd">
      {/* ─── Top Banner ─── */}
      <div className="cd__banner">
        {community.banner_url ? <img src={community.banner_url} alt="" /> : <div className="cd__banner-gradient" />}
        <div className="cd__banner-overlay">
          <h1>{community.name} 🎮</h1>
          <span>{community.member_count || members.length} miembros · {onlineMembers} en línea</span>
          {(community.my_role === 'owner' || community.my_role === 'admin' || community.owner_id === user?.id) && (
            <>
              <input ref={bannerInputRef} type="file" accept="image/*" hidden onChange={handleBannerUpload} />
              <button className="cd__banner-upload" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}>
                {uploadingBanner ? <Loader2 size={16} className="cd__spinner" /> : <Camera size={16} />}
                {uploadingBanner ? 'Subiendo...' : 'Portada'}
              </button>
            </>
          )}
          <button className="cd__invite-btn" onClick={copyInvite}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Invitar'}
          </button>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="cd__tabs">
        {[
          { key: 'summary', label: 'Resumen' },
          { key: 'chat', label: 'Chat' },
          { key: 'announcements', label: 'Anuncios' },
          { key: 'events', label: 'Eventos' },
          { key: 'settings', label: 'Ajustes' },
        ].map(t => (
          <button key={t.key} className={`cd__tab ${activeTab === t.key ? 'cd__tab--active' : ''}`}
            onClick={() => setActiveTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ─── 3-Column Layout ─── */}
      <div className="cd__body">
        {/* Column 1: Voice Rooms */}
        <div className="cd__col-voice">
          <div className="cd__section-title">Sala de voz</div>
          {community.voice_rooms?.map(room => {
            const isIn = inVoiceRoom === room.id
            return (
              <div key={room.id} className={`cd__voice-card ${isIn ? 'cd__voice-card--active' : ''}`}>
                <div className="cd__voice-card-header">
                  <Volume2 size={16} />
                  <div>
                    <div className="cd__voice-card-name">{room.name}</div>
                    <div className="cd__voice-card-meta">
                      {isIn ? voiceParticipants.length : (room.participant_count || 0)} conectados
                      {isIn && <span className="cd__live-badge">En vivo</span>}
                    </div>
                  </div>
                </div>
                {isIn && (
                  <div className="cd__voice-participants">
                    {voiceParticipants.map(p => (
                      <div key={p.userId} className={`cd__voice-user ${p.userId === user?.id && isMuted ? 'cd__voice-user--muted' : ''}`}>
                        <div className="cd__voice-avatar">
                          {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{(p.username || '??').slice(0,2).toUpperCase()}</span>}
                          {p.userId === user?.id && isMuted && <div className="cd__muted-badge"><MicOff size={10} /></div>}
                        </div>
                        <span>{p.userId === user?.id ? 'Tú' : (p.display_name || p.username)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="cd__voice-actions">
                  {!isIn ? (
                    <button className="cd__voice-join" onClick={() => joinVoiceRoom(room.id)}>Unirse</button>
                  ) : (
                    <>
                      <button className={`cd__voice-ctrl ${isMuted ? 'cd__voice-ctrl--red' : ''}`} onClick={toggleMute}>
                        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                      </button>
                      <button className="cd__voice-ctrl cd__voice-ctrl--red" onClick={leaveVoiceRoom}>
                        <PhoneOff size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          <div className="cd__section-title" style={{ marginTop: 16 }}>Otros canales de voz</div>
          {[{ name: 'Sala 2', count: 0 }, { name: 'Sala 3', count: 0 }].map((r, i) => (
            <div key={i} className="cd__voice-card cd__voice-card--mini">
              <Volume2 size={14} />
              <span>{r.name}</span>
              <span className="cd__voice-card-count">{r.count} conectados</span>
              <button className="cd__voice-join cd__voice-join--small">Unirse</button>
            </div>
          ))}
        </div>

        {/* Column 2: Chat */}
        <div className="cd__col-chat">
          <div className="cd__chat-header">
            <Hash size={16} /> {activeChannel?.name || 'chat-general'}
          </div>
          <div className="cd__chat-messages">
            {messages.length === 0 ? (
              <div className="cd__chat-empty">Sé el primero en enviar un mensaje 🔥</div>
            ) : messages.map(msg => (
              <div key={msg.id} className={`cd__msg ${msg.user_id === user?.id ? 'cd__msg--own' : ''}`}>
                <div className="cd__msg-avatar">
                  {msg.avatar_url ? <img src={msg.avatar_url} alt="" /> : <span>{(msg.username || '??').slice(0,2).toUpperCase()}</span>}
                </div>
                <div className="cd__msg-body">
                  <div className="cd__msg-header">
                    <span className="cd__msg-name">{msg.user_id === user?.id ? 'Tú' : (msg.display_name || msg.username)}</span>
                    <span className="cd__msg-time">{new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="cd__msg-text">{msg.content}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="cd__chat-input">
            <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
              placeholder="Escribe un mensaje..." />
            {newMsg.trim() && <button className="cd__chat-send" onClick={handleSend}><Send size={18} /></button>}
          </div>
        </div>

        {/* Column 3: Sidebar (Announcements / Events / Members) */}
        <div className="cd__col-sidebar">
          {/* Announcement Card */}
          <div className="cd__sidebar-card">
            <div className="cd__sidebar-card-label"><Bell size={14} /> Anuncio destacado</div>
            <div className="cd__announcement">
              <Star size={16} className="cd__star" />
              <div>
                <h4>Bienvenidos a {community.name}</h4>
                <p>Esta es tu comunidad. Invita a tus amigos y disfruta de los canales de voz y texto.</p>
              </div>
            </div>
          </div>

          {/* Events */}
          <div className="cd__sidebar-card">
            <div className="cd__sidebar-card-label"><Calendar size={14} /> Eventos próximos</div>
            <div className="cd__event">
              <div className="cd__event-dot" />
              <div>
                <div className="cd__event-name">Sala Abierta</div>
                <div className="cd__event-time">Disponible ahora</div>
              </div>
            </div>
          </div>

          {/* Online Members */}
          <div className="cd__sidebar-card">
            <div className="cd__sidebar-card-label"><Users size={14} /> Miembros ({members.length})</div>
            <div className="cd__members-list">
              {members.slice(0, 12).map(m => (
                <div key={m.id} className="cd__member-row">
                  <div className="cd__member-avatar">
                    {m.avatar_url ? <img src={m.avatar_url} alt="" /> : <span>{(m.username || '??').slice(0,2).toUpperCase()}</span>}
                    <div className={`cd__member-status ${m.status === 'online' ? 'cd__member-status--online' : ''}`} />
                  </div>
                  <div className="cd__member-info">
                    <span>{m.display_name || m.username}</span>
                    {m.role === 'owner' && <Crown size={12} className="cd__role-icon cd__role-icon--owner" />}
                    {m.role === 'admin' && <Shield size={12} className="cd__role-icon cd__role-icon--admin" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommunityDesktop
