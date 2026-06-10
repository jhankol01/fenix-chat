import { useState, useEffect, useRef, useCallback } from 'react'
import { Hash, Volume2, Send, Crown, Shield, Megaphone, Mic, MicOff, PhoneOff, Copy, Check, Plus, Users, Settings, Calendar, Bell, Star, ChevronRight, Camera, Loader2, Globe, Lock, TrendingUp, Award, Flame, Clock, MessageSquare, UserPlus, Trash2, LogOut, Edit3, Save, X, AlertTriangle, Zap, Monitor, MonitorOff } from 'lucide-react'
import api from '../../lib/api'
import { getSocket } from '../../lib/socket'
import useAuthStore from '../../stores/authStore'
import useVoiceStore from '../../stores/voiceStore'
import './CommunityDesktop.css'

function CommunityDesktop({ community: initialCommunity, onBack }) {
  const [community, setCommunity] = useState(initialCommunity)
  const [activeTab, setActiveTab] = useState('summary')
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [copied, setCopied] = useState(false)
  // Voice
  const [inVoiceRoom, setInVoiceRoom] = useState(null)
  const [voiceParticipants, setVoiceParticipants] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  // Voice room management
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [editingRoomId, setEditingRoomId] = useState(null)
  const [editingRoomName, setEditingRoomName] = useState('')
  const localStreamRef = useRef(null)
  const peerConnectionsRef = useRef({})
  const audioElementsRef = useRef({})
  const inVoiceRoomRef = useRef(null)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const screenStreamRef = useRef(null)
  const screenVideoRef = useRef(null)
  const [screenSharer, setScreenSharer] = useState(null)
  const messagesEndRef = useRef(null)
  const bannerInputRef = useRef(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const user = useAuthStore(s => s.user)

  // ─── New State Variables ─────────────────────────────────
  const [announcements, setAnnouncements] = useState([])
  const [newAnnouncement, setNewAnnouncement] = useState('')
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)
  const [events, setEvents] = useState([])
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [eventForm, setEventForm] = useState({ name: '', date: '', time: '', description: '' })
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [pulseEnergy, setPulseEnergy] = useState(0)
  const [weeklyActivity, setWeeklyActivity] = useState([0,0,0,0,0,0,0])
  const [topContributors, setTopContributors] = useState([])
  const [communityStreak, setCommunityStreak] = useState(0)

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

  // Voice room CRUD
  const createVoiceRoom = async (e) => {
    e.preventDefault()
    if (!newRoomName.trim() || !community?.id) return
    try {
      const data = await api.post(`/communities/${community.id}/voice-rooms`, { name: newRoomName.trim() })
      if (data.voiceRoom) {
        setCommunity(prev => ({ ...prev, voice_rooms: [...(prev.voice_rooms || []), data.voiceRoom] }))
      }
      setNewRoomName('')
      setShowCreateRoom(false)
    } catch (err) { alert(err.message || 'Error al crear sala') }
  }

  const saveRoomName = async (roomId) => {
    if (!editingRoomName.trim() || !community?.id) { setEditingRoomId(null); return }
    try {
      const data = await api.patch(`/communities/${community.id}/voice-rooms/${roomId}`, { name: editingRoomName.trim() })
      if (data.voiceRoom) {
        setCommunity(prev => ({
          ...prev,
          voice_rooms: prev.voice_rooms.map(r => r.id === roomId ? { ...r, name: data.voiceRoom.name } : r)
        }))
      }
    } catch (err) { alert(err.message || 'Error al renombrar sala') }
    setEditingRoomId(null)
  }

  const deleteVoiceRoom = async (roomId) => {
    if (!confirm('¿Eliminar esta sala de voz?')) return
    try {
      await api.delete(`/communities/${community.id}/voice-rooms/${roomId}`)
      setCommunity(prev => ({
        ...prev,
        voice_rooms: prev.voice_rooms.filter(r => r.id !== roomId)
      }))
    } catch (err) { alert(err.message || 'Error al eliminar sala') }
  }

  const togglePrivacy = async () => {
    const newVal = community.is_public === false ? true : false
    try {
      const data = await api.patch(`/communities/${community.id}`, { isPublic: newVal })
      if (data.community) {
        setCommunity(prev => ({ ...prev, is_public: data.community.is_public }))
      }
    } catch (err) { alert(err.message || 'Error al cambiar privacidad') }
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

  // ─── New Effects ─────────────────────────────────────────

  // Load announcements
  useEffect(() => {
    if (activeTab === 'announcements' && community?.id) {
      const annChannel = community.channels?.find(c => c.type === 'announcements')
      if (annChannel) {
        api.get(`/communities/${community.id}/channels/${annChannel.id}/messages`)
          .then(data => setAnnouncements((data.messages || []).reverse()))
          .catch(console.error)
      }
    }
  }, [activeTab, community?.id])

  // Load events
  useEffect(() => {
    if (community?.id) {
      const stored = localStorage.getItem(`fenix_events_${community.id}`)
      if (stored) setEvents(JSON.parse(stored))
    }
  }, [community?.id])

  // Init settings
  useEffect(() => {
    if (activeTab === 'settings' && community) {
      setEditName(community.name || '')
      setEditDescription(community.description || '')
    }
  }, [activeTab, community?.id])

  // Fenix Pulse
  useEffect(() => {
    if (community) {
      const memberEnergy = Math.min((community.member_count || members.length || 1) * 8, 100)
      setPulseEnergy(Math.min(memberEnergy + Math.floor(Math.random() * 15), 100))
      const today = new Date().getDay()
      setWeeklyActivity(Array.from({length: 7}, (_, i) => {
        const base = Math.floor(Math.random() * 30) + 5
        return i === today ? base + 20 : base
      }))
      setTopContributors(members.slice(0, 5).map((m, i) => ({
        ...m, messages: Math.floor(Math.random() * 50) + (5 - i) * 10,
        xp: Math.floor(Math.random() * 500) + (5 - i) * 100
      })))
      setCommunityStreak(Math.floor(Math.random() * 14) + 1)
    }
  }, [community, members])

  // ─── WebRTC Voice ─────────────────────────────────────────
  const createPeerConnection = useCallback((remoteUserId) => {
    if (peerConnectionsRef.current[remoteUserId]) peerConnectionsRef.current[remoteUserId].close()
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] })
    peerConnectionsRef.current[remoteUserId] = pc
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current))
    // Also add screen share track if currently sharing
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => pc.addTrack(t, screenStreamRef.current))
    }
    pc.ontrack = (e) => {
      if (e.track.kind === 'video') {
        // Screen share track from remote
        console.log('🖥️ Received screen share from', remoteUserId)
        setScreenSharer(remoteUserId)
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = e.streams[0] || new MediaStream([e.track])
        }
        e.track.onended = () => { setScreenSharer(null) }
      } else {
        let audio = audioElementsRef.current[remoteUserId]
        if (!audio) { audio = new Audio(); audio.autoplay = true; audio.volume = 1.0; audioElementsRef.current[remoteUserId] = audio }
        audio.srcObject = e.streams[0]; audio.play().catch(() => {})
      }
    }
    // Handle renegotiation needed (e.g. when screen share track is added)
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        const socket = getSocket()
        if (socket) socket.emit('voice_offer', { to: remoteUserId, offer })
      } catch(e) { console.error('Renegotiation error:', e) }
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
      try {
        // Check if we already have a PC for this peer (renegotiation)
        let pc = peerConnectionsRef.current[from]
        if (pc && pc.signalingState !== 'closed') {
          // Renegotiation — reuse existing connection
          await pc.setRemoteDescription(new RTCSessionDescription(offer))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('voice_answer', { to: from, answer })
        } else {
          // New connection
          pc = createPeerConnection(from)
          await pc.setRemoteDescription(new RTCSessionDescription(offer))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('voice_answer', { to: from, answer })
        }
      } catch (e) { console.error('onOffer error:', e) }
    }
    const onAnswer = async ({ from, answer }) => { const pc = peerConnectionsRef.current[from]; if (pc) try { await pc.setRemoteDescription(new RTCSessionDescription(answer)) } catch(e){} }
    const onIce = async ({ from, candidate }) => { const pc = peerConnectionsRef.current[from]; if (pc && candidate) try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch(e){} }
    socket.on('voice_room_users', onRoomUsers); socket.on('voice_user_joined', onUserJoined); socket.on('voice_user_left', onUserLeft)
    socket.on('voice_offer', onOffer); socket.on('voice_answer', onAnswer); socket.on('voice_ice', onIce)
    return () => { socket.off('voice_room_users', onRoomUsers); socket.off('voice_user_joined', onUserJoined); socket.off('voice_user_left', onUserLeft); socket.off('voice_offer', onOffer); socket.off('voice_answer', onAnswer); socket.off('voice_ice', onIce) }
  }, [user?.id, createPeerConnection])

  const joinVoiceRoom = async (roomId) => {
    const room = community.voice_rooms?.find(r => r.id === roomId)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream; inVoiceRoomRef.current = roomId; setInVoiceRoom(roomId); setIsMuted(false)
      setVoiceParticipants([{ userId: user.id, username: user.username, display_name: user.display_name, avatar_url: user.avatar_url }])
      const socket = getSocket(); if (socket) socket.emit('join_voice_room', { roomId })
      // Sync global store
      useVoiceStore.getState().joinRoom({
        roomId,
        roomName: room?.name || 'Sala de voz',
        communityName: community.name,
        communityId: community.id,
      })
    } catch (e) { alert('No se pudo acceder al micrófono') }
  }
  const leaveVoiceRoom = () => {
    const socket = getSocket(); const rid = inVoiceRoomRef.current
    if (socket && rid) socket.emit('leave_voice_room', { roomId: rid })
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null }
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close()); peerConnectionsRef.current = {}
    Object.values(audioElementsRef.current).forEach(a => { try { a.srcObject = null } catch(e){} }); audioElementsRef.current = {}
    inVoiceRoomRef.current = null; setInVoiceRoom(null); setVoiceParticipants([])
    useVoiceStore.getState().leaveRoom()
  }
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted })
      setIsMuted(!isMuted)
      useVoiceStore.getState().setMuted(!isMuted)
    }
  }

  // ─── Screen Share ─────────────────────────────────────────
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop())
        screenStreamRef.current = null
      }
      // Remove video track from all peers
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const senders = pc.getSenders()
        const videoSender = senders.find(s => s.track?.kind === 'video')
        if (videoSender) pc.removeTrack(videoSender)
      })
      setIsScreenSharing(false)
      setScreenSharer(null)
      // Notify via socket
      const socket = getSocket()
      if (socket) socket.emit('voice_screen_stop', { roomId: inVoiceRoomRef.current })
    } else {
      // Start sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false })
        screenStreamRef.current = screenStream
        const videoTrack = screenStream.getVideoTracks()[0]
        
        // Add video track to all existing peer connections
        Object.values(peerConnectionsRef.current).forEach(pc => {
          pc.addTrack(videoTrack, screenStream)
          // Renegotiate
          pc.createOffer().then(offer => {
            pc.setLocalDescription(offer)
            const peerId = Object.keys(peerConnectionsRef.current).find(k => peerConnectionsRef.current[k] === pc)
            const socket = getSocket()
            if (socket && peerId) socket.emit('voice_offer', { to: peerId, offer })
          })
        })
        
        setIsScreenSharing(true)
        setScreenSharer(user?.id)
        
        // Show own screen
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = screenStream
        }
        
        // Handle when user stops sharing via browser UI
        videoTrack.onended = () => {
          setIsScreenSharing(false)
          setScreenSharer(null)
          screenStreamRef.current = null
          Object.values(peerConnectionsRef.current).forEach(pc => {
            const senders = pc.getSenders()
            const vs = senders.find(s => s.track?.kind === 'video')
            if (vs) pc.removeTrack(vs)
          })
        }
      } catch (e) {
        console.error('Screen share error:', e)
      }
    }
  }

  // Sync participant count to global store
  useEffect(() => {
    if (inVoiceRoom) useVoiceStore.getState().setParticipantCount(voiceParticipants.length)
  }, [voiceParticipants.length, inVoiceRoom])

  // Listen for indicator controls (mute/leave from global bar)
  useEffect(() => {
    const handleToggleMute = () => toggleMute()
    const handleLeave = () => leaveVoiceRoom()
    window.addEventListener('voice-toggle-mute', handleToggleMute)
    window.addEventListener('voice-leave', handleLeave)
    return () => {
      window.removeEventListener('voice-toggle-mute', handleToggleMute)
      window.removeEventListener('voice-leave', handleLeave)
    }
  })

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

  // ─── New Handlers ─────────────────────────────────────────
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const isOwnerOrAdmin = community?.my_role === 'owner' || community?.my_role === 'admin' || community?.owner_id === user?.id

  const postAnnouncement = async () => {
    if (!newAnnouncement.trim()) return
    const annChannel = community.channels?.find(c => c.type === 'announcements')
    if (!annChannel) return
    setPostingAnnouncement(true)
    const socket = getSocket()
    if (socket) {
      socket.emit('channel_message', { channelId: annChannel.id, content: newAnnouncement.trim(), type: 'text' })
      setAnnouncements(prev => [{ id: Date.now(), content: newAnnouncement.trim(), username: user.username, display_name: user.display_name, avatar_url: user.avatar_url, user_id: user.id, created_at: new Date().toISOString() }, ...prev])
    }
    setNewAnnouncement('')
    setPostingAnnouncement(false)
  }

  const createEvent = () => {
    if (!eventForm.name.trim() || !eventForm.date) return
    const newEvent = { id: Date.now(), name: eventForm.name.trim(), date: eventForm.date, time: eventForm.time || '00:00', description: eventForm.description.trim(), created_by: user.display_name || user.username, created_at: new Date().toISOString() }
    const updated = [...events, newEvent].sort((a, b) => new Date(a.date) - new Date(b.date))
    setEvents(updated)
    localStorage.setItem(`fenix_events_${community.id}`, JSON.stringify(updated))
    setEventForm({ name: '', date: '', time: '', description: '' })
    setShowCreateEvent(false)
  }

  const deleteEvent = (eventId) => {
    const updated = events.filter(e => e.id !== eventId)
    setEvents(updated)
    localStorage.setItem(`fenix_events_${community.id}`, JSON.stringify(updated))
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const data = await api.patch(`/communities/${community.id}`, { name: editName.trim(), description: editDescription.trim() })
      if (data.community) setCommunity(prev => ({ ...prev, ...data.community }))
    } catch (err) { alert(err.message || 'Error al guardar') }
    setSavingSettings(false)
  }

  const leaveCommunity = async () => {
    if (!confirm('¿Seguro que quieres salir de esta comunidad?')) return
    try { await api.post(`/communities/${community.id}/leave`); onBack() } catch (err) { alert(err.message || 'Error al salir') }
  }

  const deleteCommunity = async () => {
    const name = prompt(`Escribe "${community.name}" para confirmar la eliminación:`)
    if (name !== community.name) return
    try { await api.delete(`/communities/${community.id}`); onBack() } catch (err) { alert(err.message || 'Error al eliminar') }
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

      {/* ─── Body: Tab-specific content ─── */}
      <div className="cd__body">

        {/* ═══════════════ SUMMARY TAB ═══════════════ */}
        {activeTab === 'summary' && (
          <div className="cd__summary">
            {/* Fenix Pulse Card */}
            <div className="cd__pulse-card">
              <div className="cd__pulse-header">
                <Zap size={20} className="cd__pulse-icon" />
                <h3>Fenix Pulse</h3>
                <span className="cd__pulse-energy">{pulseEnergy}%</span>
              </div>
              <div className="cd__pulse-bar-bg">
                <div className="cd__pulse-bar-fill" style={{ width: `${pulseEnergy}%` }} />
              </div>
              <div className="cd__pulse-streak">
                <Flame size={14} />
                <span>Racha de {communityStreak} días</span>
              </div>
              <div className="cd__pulse-week">
                {weeklyActivity.map((val, i) => (
                  <div key={i} className="cd__pulse-day">
                    <div className="cd__pulse-day-bar" style={{ height: `${Math.max(val, 5)}%` }} />
                    <span>{dayNames[i]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="cd__stats-grid">
              <div className="cd__stat-card">
                <Users size={20} />
                <div className="cd__stat-value">{community.member_count || members.length}</div>
                <div className="cd__stat-label">Miembros</div>
              </div>
              <div className="cd__stat-card">
                <div className="cd__stat-online-dot" />
                <div className="cd__stat-value">{onlineMembers}</div>
                <div className="cd__stat-label">En línea</div>
              </div>
              <div className="cd__stat-card">
                <Hash size={20} />
                <div className="cd__stat-value">{community.channels?.length || 0}</div>
                <div className="cd__stat-label">Canales</div>
              </div>
              <div className="cd__stat-card">
                <Volume2 size={20} />
                <div className="cd__stat-value">{community.voice_rooms?.length || 0}</div>
                <div className="cd__stat-label">Salas de voz</div>
              </div>
            </div>

            {/* Top Contributors */}
            <div className="cd__summary-section">
              <div className="cd__summary-section-title">
                <Award size={16} />
                <span>Top Contribuidores</span>
              </div>
              <div className="cd__contributors-list">
                {topContributors.map((c, i) => (
                  <div key={c.id || i} className="cd__contributor-row">
                    <span className="cd__contributor-rank">#{i + 1}</span>
                    <div className="cd__contributor-avatar">
                      {c.avatar_url ? <img src={c.avatar_url} alt="" /> : <span>{(c.username || '??').slice(0,2).toUpperCase()}</span>}
                    </div>
                    <div className="cd__contributor-info">
                      <span className="cd__contributor-name">{c.display_name || c.username}</span>
                      <span className="cd__contributor-xp">{c.xp} XP</span>
                    </div>
                    <div className="cd__contributor-msgs">
                      <MessageSquare size={12} />
                      <span>{c.messages}</span>
                    </div>
                  </div>
                ))}
                {topContributors.length === 0 && (
                  <div className="cd__empty-state">Sin datos de contribuidores aún</div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="cd__summary-section">
              <div className="cd__summary-section-title">
                <Clock size={16} />
                <span>Actividad Reciente</span>
              </div>
              <div className="cd__recent-activity">
                {messages.slice(-5).reverse().map(msg => (
                  <div key={msg.id} className="cd__activity-item">
                    <div className="cd__activity-avatar">
                      {msg.avatar_url ? <img src={msg.avatar_url} alt="" /> : <span>{(msg.username || '??').slice(0,2).toUpperCase()}</span>}
                    </div>
                    <div className="cd__activity-content">
                      <span className="cd__activity-user">{msg.display_name || msg.username}</span>
                      <span className="cd__activity-text">{msg.content?.slice(0, 80)}{msg.content?.length > 80 ? '...' : ''}</span>
                    </div>
                    <span className="cd__activity-time">{new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="cd__empty-state">No hay actividad reciente</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ CHAT TAB ═══════════════ */}
        {activeTab === 'chat' && (
          <>
            {/* Column 1: Voice Rooms */}
            <div className="cd__col-voice">
              <div className="cd__section-title">Salas de voz</div>
              {community.voice_rooms?.map(room => {
                const isIn = inVoiceRoom === room.id
                const isEditing = editingRoomId === room.id
                return (
                  <div key={room.id} className={`cd__voice-card ${isIn ? 'cd__voice-card--active' : ''}`}>
                    <div className="cd__voice-card-header">
                      <Volume2 size={16} />
                      <div style={{ flex: 1 }}>
                        {isEditing ? (
                          <form onSubmit={(e) => { e.preventDefault(); saveRoomName(room.id) }} className="cd__room-edit-form">
                            <input
                              value={editingRoomName}
                              onChange={e => setEditingRoomName(e.target.value)}
                              autoFocus
                              className="cd__room-edit-input"
                              onBlur={() => saveRoomName(room.id)}
                            />
                          </form>
                        ) : (
                          <div className="cd__voice-card-name" onDoubleClick={() => {
                            if (community.my_role === 'owner' || community.my_role === 'admin' || community.owner_id === user?.id) {
                              setEditingRoomId(room.id); setEditingRoomName(room.name)
                            }
                          }}>{room.name}</div>
                        )}
                        <div className="cd__voice-card-meta">
                          {isIn ? voiceParticipants.length : (room.participant_count || 0)} conectados
                          {isIn && <span className="cd__live-badge">En vivo</span>}
                        </div>
                      </div>
                      {/* Delete button for owner/admin */}
                      {(community.my_role === 'owner' || community.my_role === 'admin' || community.owner_id === user?.id) && community.voice_rooms.length > 1 && !isIn && (
                        <button className="cd__room-delete" onClick={() => deleteVoiceRoom(room.id)} title="Eliminar sala">×</button>
                      )}
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
                    {/* Screen Share Display */}
                    {isIn && screenSharer && (
                      <div className="cd__screen-share">
                        <div className="cd__screen-share-header">
                          <Monitor size={14} />
                          <span>{screenSharer === user?.id ? 'Compartiendo tu pantalla' : 'Pantalla compartida'}</span>
                        </div>
                        <video
                          ref={screenVideoRef}
                          className="cd__screen-share-video"
                          autoPlay
                          playsInline
                        />
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
                          <button className={`cd__voice-ctrl ${isScreenSharing ? 'cd__voice-ctrl--green' : ''}`} onClick={toggleScreenShare} title="Compartir pantalla">
                            {isScreenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
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

              {/* Create new voice room */}
              {(community.my_role === 'owner' || community.my_role === 'admin' || community.owner_id === user?.id) && (
                showCreateRoom ? (
                  <form className="cd__create-room-form" onSubmit={createVoiceRoom}>
                    <input
                      value={newRoomName}
                      onChange={e => setNewRoomName(e.target.value)}
                      placeholder="Nombre de la sala..."
                      autoFocus
                      className="cd__room-edit-input"
                    />
                    <div className="cd__create-room-btns">
                      <button type="submit" className="cd__voice-join cd__voice-join--small" disabled={!newRoomName.trim()}>Crear</button>
                      <button type="button" className="cd__voice-join cd__voice-join--small cd__voice-join--cancel" onClick={() => { setShowCreateRoom(false); setNewRoomName('') }}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <button className="cd__create-room-btn" onClick={() => setShowCreateRoom(true)}>
                    <Plus size={14} />
                    Crear sala de voz
                  </button>
                )
              )}
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
              {/* Privacy toggle for owner/admin */}
              {(community.my_role === 'owner' || community.my_role === 'admin' || community.owner_id === user?.id) && (
                <div className="cd__sidebar-card cd__privacy-card">
                  <div className="cd__privacy-row">
                    <div className="cd__privacy-info">
                      {community.is_public !== false ? <Globe size={16} /> : <Lock size={16} />}
                      <div>
                        <div className="cd__privacy-label">{community.is_public !== false ? 'Pública' : 'Privada'}</div>
                        <div className="cd__privacy-desc">{community.is_public !== false ? 'Visible en Descubrir' : 'Solo con invitación'}</div>
                      </div>
                    </div>
                    <button
                      className={`cd__privacy-switch ${community.is_public !== false ? 'cd__privacy-switch--on' : ''}`}
                      onClick={togglePrivacy}
                    >
                      <div className="cd__privacy-switch-thumb" />
                    </button>
                  </div>
                </div>
              )}

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
          </>
        )}

        {/* ═══════════════ ANNOUNCEMENTS TAB ═══════════════ */}
        {activeTab === 'announcements' && (
          <div className="cd__announcements-panel">
            <div className="cd__announcements-header">
              <Megaphone size={22} />
              <h2>Anuncios</h2>
            </div>

            {/* Compose form (owner/admin only) */}
            {isOwnerOrAdmin && (
              <div className="cd__announcement-compose">
                <textarea
                  value={newAnnouncement}
                  onChange={e => setNewAnnouncement(e.target.value)}
                  placeholder="Escribe un anuncio para tu comunidad..."
                  rows={3}
                  className="cd__announcement-textarea"
                />
                <button
                  className="cd__announcement-post-btn"
                  onClick={postAnnouncement}
                  disabled={!newAnnouncement.trim() || postingAnnouncement}
                >
                  {postingAnnouncement ? <Loader2 size={16} className="cd__spinner" /> : <Send size={16} />}
                  Publicar anuncio
                </button>
              </div>
            )}

            {/* Announcements list */}
            <div className="cd__announcements-list">
              {announcements.length === 0 ? (
                <div className="cd__empty-state">
                  <Bell size={40} />
                  <p>No hay anuncios aún</p>
                  {isOwnerOrAdmin && <span>Publica el primer anuncio de tu comunidad</span>}
                </div>
              ) : announcements.map(ann => (
                <div key={ann.id} className="cd__announcement-card">
                  <div className="cd__announcement-card-header">
                    <div className="cd__announcement-card-avatar">
                      {ann.avatar_url ? <img src={ann.avatar_url} alt="" /> : <span>{(ann.username || '??').slice(0,2).toUpperCase()}</span>}
                    </div>
                    <div className="cd__announcement-card-info">
                      <span className="cd__announcement-card-name">
                        {ann.display_name || ann.username}
                        <Crown size={12} className="cd__role-icon cd__role-icon--owner" />
                      </span>
                      <span className="cd__announcement-card-time">
                        {new Date(ann.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="cd__announcement-card-content">{ann.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ EVENTS TAB ═══════════════ */}
        {activeTab === 'events' && (
          <div className="cd__events-panel">
            <div className="cd__events-header">
              <Calendar size={22} />
              <h2>Eventos</h2>
              {isOwnerOrAdmin && (
                <button className="cd__events-create-btn" onClick={() => setShowCreateEvent(!showCreateEvent)}>
                  {showCreateEvent ? <X size={16} /> : <Plus size={16} />}
                  {showCreateEvent ? 'Cancelar' : 'Crear evento'}
                </button>
              )}
            </div>

            {/* Create event form */}
            {showCreateEvent && (
              <div className="cd__event-form">
                <input
                  type="text"
                  placeholder="Nombre del evento"
                  value={eventForm.name}
                  onChange={e => setEventForm(prev => ({ ...prev, name: e.target.value }))}
                  className="cd__event-form-input"
                />
                <div className="cd__event-form-row">
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={e => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                    className="cd__event-form-input"
                  />
                  <input
                    type="time"
                    value={eventForm.time}
                    onChange={e => setEventForm(prev => ({ ...prev, time: e.target.value }))}
                    className="cd__event-form-input"
                  />
                </div>
                <textarea
                  placeholder="Descripción (opcional)"
                  value={eventForm.description}
                  onChange={e => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                  className="cd__event-form-textarea"
                  rows={2}
                />
                <button className="cd__event-form-submit" onClick={createEvent} disabled={!eventForm.name.trim() || !eventForm.date}>
                  <Plus size={16} />
                  Crear evento
                </button>
              </div>
            )}

            {/* Events list */}
            <div className="cd__events-list">
              {events.length === 0 ? (
                <div className="cd__empty-state">
                  <Calendar size={40} />
                  <p>No hay eventos programados</p>
                  {isOwnerOrAdmin && <span>Crea el primer evento de tu comunidad</span>}
                </div>
              ) : events.map(ev => {
                const evDate = new Date(ev.date + 'T' + (ev.time || '00:00'))
                const isPast = evDate < new Date()
                const daysUntil = Math.ceil((evDate - new Date()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={ev.id} className={`cd__event-card ${isPast ? 'cd__event-card--past' : ''}`}>
                    <div className="cd__event-card-date">
                      <span className="cd__event-card-day">{evDate.getDate()}</span>
                      <span className="cd__event-card-month">{evDate.toLocaleDateString('es', { month: 'short' })}</span>
                    </div>
                    <div className="cd__event-card-info">
                      <div className="cd__event-card-name">{ev.name}</div>
                      <div className="cd__event-card-time">
                        <Clock size={12} />
                        {ev.time || '00:00'}
                        {!isPast && daysUntil >= 0 && (
                          <span className="cd__event-card-badge">
                            {daysUntil === 0 ? '¡Hoy!' : `En ${daysUntil} día${daysUntil > 1 ? 's' : ''}`}
                          </span>
                        )}
                        {isPast && <span className="cd__event-card-badge cd__event-card-badge--past">Pasado</span>}
                      </div>
                      {ev.description && <div className="cd__event-card-desc">{ev.description}</div>}
                      <div className="cd__event-card-creator">Creado por {ev.created_by}</div>
                    </div>
                    {isOwnerOrAdmin && (
                      <button className="cd__event-card-delete" onClick={() => deleteEvent(ev.id)} title="Eliminar evento">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══════════════ SETTINGS TAB ═══════════════ */}
        {activeTab === 'settings' && (
          <div className="cd__settings-panel">
            <div className="cd__settings-header">
              <Settings size={22} />
              <h2>Ajustes</h2>
            </div>

            {isOwnerOrAdmin ? (
              <>
                {/* General info section */}
                <div className="cd__settings-section">
                  <div className="cd__settings-section-title">
                    <Edit3 size={16} />
                    <span>Información general</span>
                  </div>
                  <div className="cd__settings-field">
                    <label>Nombre de la comunidad</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="cd__settings-input"
                    />
                  </div>
                  <div className="cd__settings-field">
                    <label>Descripción</label>
                    <textarea
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      className="cd__settings-textarea"
                      rows={3}
                    />
                  </div>
                  <button className="cd__settings-save-btn" onClick={saveSettings} disabled={savingSettings}>
                    {savingSettings ? <Loader2 size={16} className="cd__spinner" /> : <Save size={16} />}
                    {savingSettings ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>

                {/* Banner section */}
                <div className="cd__settings-section">
                  <div className="cd__settings-section-title">
                    <Camera size={16} />
                    <span>Portada</span>
                  </div>
                  <button className="cd__settings-upload-btn" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}>
                    {uploadingBanner ? <Loader2 size={16} className="cd__spinner" /> : <Camera size={16} />}
                    {uploadingBanner ? 'Subiendo...' : 'Cambiar portada'}
                  </button>
                </div>

                {/* Privacy section */}
                <div className="cd__settings-section">
                  <div className="cd__settings-section-title">
                    {community.is_public !== false ? <Globe size={16} /> : <Lock size={16} />}
                    <span>Privacidad</span>
                  </div>
                  <div className="cd__privacy-row">
                    <div className="cd__privacy-info">
                      {community.is_public !== false ? <Globe size={16} /> : <Lock size={16} />}
                      <div>
                        <div className="cd__privacy-label">{community.is_public !== false ? 'Pública' : 'Privada'}</div>
                        <div className="cd__privacy-desc">{community.is_public !== false ? 'Visible en Descubrir' : 'Solo con invitación'}</div>
                      </div>
                    </div>
                    <button
                      className={`cd__privacy-switch ${community.is_public !== false ? 'cd__privacy-switch--on' : ''}`}
                      onClick={togglePrivacy}
                    >
                      <div className="cd__privacy-switch-thumb" />
                    </button>
                  </div>
                </div>

                {/* Invite code section */}
                <div className="cd__settings-section">
                  <div className="cd__settings-section-title">
                    <UserPlus size={16} />
                    <span>Código de invitación</span>
                  </div>
                  <div className="cd__settings-invite-row">
                    <code className="cd__settings-invite-code">{community.invite_code || 'N/A'}</code>
                    <button className="cd__settings-copy-btn" onClick={copyInvite}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Members management */}
                <div className="cd__settings-section">
                  <div className="cd__settings-section-title">
                    <Users size={16} />
                    <span>Miembros ({members.length})</span>
                  </div>
                  <div className="cd__settings-members-list">
                    {members.map(m => (
                      <div key={m.id} className="cd__settings-member-row">
                        <div className="cd__member-avatar">
                          {m.avatar_url ? <img src={m.avatar_url} alt="" /> : <span>{(m.username || '??').slice(0,2).toUpperCase()}</span>}
                        </div>
                        <div className="cd__member-info">
                          <span>{m.display_name || m.username}</span>
                          {m.role === 'owner' && <Crown size={12} className="cd__role-icon cd__role-icon--owner" />}
                          {m.role === 'admin' && <Shield size={12} className="cd__role-icon cd__role-icon--admin" />}
                        </div>
                        <span className="cd__settings-member-role">{m.role || 'member'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Danger zone */}
                <div className="cd__settings-section cd__settings-danger">
                  <div className="cd__settings-section-title">
                    <AlertTriangle size={16} />
                    <span>Zona de peligro</span>
                  </div>
                  <p className="cd__settings-danger-text">Estas acciones son irreversibles. Procede con precaución.</p>
                  <div className="cd__settings-danger-actions">
                    <button className="cd__settings-danger-btn cd__settings-danger-btn--delete" onClick={deleteCommunity}>
                      <Trash2 size={16} />
                      Eliminar comunidad
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Member view - read only */}
                <div className="cd__settings-section">
                  <div className="cd__settings-section-title">
                    <Edit3 size={16} />
                    <span>Información de la comunidad</span>
                  </div>
                  <div className="cd__settings-field">
                    <label>Nombre</label>
                    <div className="cd__settings-readonly">{community.name}</div>
                  </div>
                  <div className="cd__settings-field">
                    <label>Descripción</label>
                    <div className="cd__settings-readonly">{community.description || 'Sin descripción'}</div>
                  </div>
                  <div className="cd__settings-field">
                    <label>Miembros</label>
                    <div className="cd__settings-readonly">{community.member_count || members.length} miembros</div>
                  </div>
                  <div className="cd__settings-field">
                    <label>Tipo</label>
                    <div className="cd__settings-readonly">{community.is_public !== false ? 'Pública' : 'Privada'}</div>
                  </div>
                </div>

                {/* Leave community */}
                <div className="cd__settings-section cd__settings-danger">
                  <div className="cd__settings-section-title">
                    <AlertTriangle size={16} />
                    <span>Zona de peligro</span>
                  </div>
                  <button className="cd__settings-danger-btn" onClick={leaveCommunity}>
                    <LogOut size={16} />
                    Salir de la comunidad
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default CommunityDesktop
