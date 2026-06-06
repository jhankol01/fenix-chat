import { useState, useRef, useEffect, useCallback } from 'react'
import { Phone, PhoneOff, Mic, MicOff, X } from 'lucide-react'
import { getSocket } from '../../lib/socket'
import useAuthStore from '../../stores/authStore'
import './CallOverlay.css'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
}

function CallOverlay() {
  const [callState, setCallState] = useState('idle')
  const [remoteUser, setRemoteUser] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const durationTimerRef = useRef(null)
  const callerIdRef = useRef(null)
  const targetUserIdRef = useRef(null)
  const ringtoneRef = useRef(null)
  const pendingOfferRef = useRef(null)
  const iceCandidateQueueRef = useRef([])
  const remoteDescSetRef = useRef(false)

  const user = useAuthStore(s => s.user)

  // --- Ringtone functions ---
  const stopRingtone = () => {
    if (ringtoneRef.current) {
      clearInterval(ringtoneRef.current.interval)
      try { ringtoneRef.current.ctx.close() } catch(e) {}
      ringtoneRef.current = null
    }
  }

  const playOutgoingTone = () => {
    stopRingtone()
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const playBeep = () => {
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        osc1.frequency.value = 440
        osc2.frequency.value = 480
        osc1.type = 'sine'
        osc2.type = 'sine'
        gain.gain.value = 0.08
        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)
        osc1.start()
        osc2.start()
        osc1.stop(ctx.currentTime + 1)
        osc2.stop(ctx.currentTime + 1)
      }
      playBeep()
      const interval = setInterval(playBeep, 4000)
      ringtoneRef.current = { ctx, interval }
    } catch(e) {}
  }

  const playIncomingRingtone = () => {
    stopRingtone()
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const playRing = () => {
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.frequency.value = i === 0 ? 800 : 640
          osc.type = 'sine'
          gain.gain.value = 0.12
          gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.25)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.2)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(ctx.currentTime + i * 0.25)
          osc.stop(ctx.currentTime + i * 0.25 + 0.2)
        }
      }
      playRing()
      const interval = setInterval(playRing, 2000)
      ringtoneRef.current = { ctx, interval }
    } catch(e) {}
  }

  // --- Cleanup ---
  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    stopRingtone()
    setCallState('idle')
    setRemoteUser(null)
    setIsMuted(false)
    setDuration(0)
    callerIdRef.current = null
    targetUserIdRef.current = null
    pendingOfferRef.current = null
    iceCandidateQueueRef.current = []
    remoteDescSetRef.current = false
  }, [])

  // --- Flush queued ICE candidates after remote description is set ---
  const flushIceCandidates = async (pc) => {
    const queue = iceCandidateQueueRef.current
    iceCandidateQueueRef.current = []
    for (const c of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c))
      } catch(e) { console.warn('ICE flush error:', e) }
    }
  }

  // --- Create RTCPeerConnection ---
  const createPC = useCallback((targetUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    const socket = getSocket()

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('ice_candidate', { targetUserId, candidate: e.candidate })
      }
    }

    pc.ontrack = (e) => {
      console.log('🔊 ontrack fired, streams:', e.streams.length)
      if (remoteAudioRef.current && e.streams[0]) {
        remoteAudioRef.current.srcObject = e.streams[0]
        remoteAudioRef.current.play().catch(() => {})
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('📶 Connection state:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        setCallState('connected')
        if (durationTimerRef.current) clearInterval(durationTimerRef.current)
        durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanup()
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE state:', pc.iceConnectionState)
    }

    pcRef.current = pc
    return pc
  }, [cleanup])

  // --- Start outgoing call (CALLER) ---
  const startCall = useCallback(async (targetUserId, targetName, targetAvatar) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      remoteDescSetRef.current = false
      iceCandidateQueueRef.current = []

      const pc = createPC(targetUserId)
      stream.getTracks().forEach(t => pc.addTrack(t, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      targetUserIdRef.current = targetUserId
      setRemoteUser({ name: targetName, avatar: targetAvatar })
      setCallState('calling')

      const socket = getSocket()
      socket.emit('call_user', {
        targetUserId,
        offer: { type: offer.type, sdp: offer.sdp },
        callerName: user?.username,
        callerAvatar: user?.avatar_url,
      })
      console.log('📞 Call emitted to', targetUserId)
    } catch (err) {
      console.error('Call error:', err)
      cleanup()
    }
  }, [user, createPC, cleanup])

  // --- Answer incoming call (RECEIVER) ---
  const answerCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const callerId = callerIdRef.current
      const offer = pendingOfferRef.current
      if (!offer) { console.error('No pending offer'); cleanup(); return }

      // Use existing PC or create new
      const pc = pcRef.current || createPC(callerId)
      stream.getTracks().forEach(t => pc.addTrack(t, stream))

      // Set remote description (the caller's offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      remoteDescSetRef.current = true

      // Flush any queued ICE candidates
      await flushIceCandidates(pc)

      // Create and set answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      targetUserIdRef.current = callerId
      pendingOfferRef.current = null

      const socket = getSocket()
      socket.emit('call_accepted', {
        callerId,
        answer: { type: answer.type, sdp: answer.sdp }
      })

      stopRingtone()
      setCallState('connected')
      durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
      console.log('✅ Call answered, answer sent')
    } catch (err) {
      console.error('Answer error:', err)
      cleanup()
    }
  }, [createPC, cleanup])

  // --- Reject / End ---
  const rejectCall = useCallback(() => {
    const socket = getSocket()
    if (callerIdRef.current) socket.emit('call_rejected', { callerId: callerIdRef.current })
    cleanup()
  }, [cleanup])

  const endCall = useCallback(() => {
    const socket = getSocket()
    const target = targetUserIdRef.current
    const dur = duration
    if (target) socket.emit('end_call', { targetUserId: target, duration: dur })
    cleanup()
  }, [cleanup, duration])

  const toggleMute = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0]
      if (track) {
        track.enabled = !track.enabled
        setIsMuted(!track.enabled)
      }
    }
  }

  // --- Ringtone effect ---
  useEffect(() => {
    if (callState === 'calling') playOutgoingTone()
    else if (callState === 'ringing') playIncomingRingtone()
    else stopRingtone()
    return () => stopRingtone()
  }, [callState])

  // --- Socket listeners ---
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onIncomingCall = ({ callerId, callerName, callerAvatar, offer }) => {
      console.log('📞 Incoming call from', callerName, callerId)
      if (callState !== 'idle') {
        socket.emit('call_rejected', { callerId })
        return
      }
      callerIdRef.current = callerId
      pendingOfferRef.current = offer
      remoteDescSetRef.current = false
      iceCandidateQueueRef.current = []
      setRemoteUser({ name: callerName, avatar: callerAvatar })
      setCallState('ringing')
      // Create PC so we can receive ICE candidates while ringing
      if (!pcRef.current) createPC(callerId)
    }

    const onCallAnswered = async ({ answer }) => {
      console.log('📞 Call answered by remote')
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
          remoteDescSetRef.current = true
          await flushIceCandidates(pcRef.current)
          stopRingtone()
        } catch(e) { console.error('setRemoteDescription error:', e) }
      }
    }

    const onCallRejected = () => { cleanup() }

    const onIceCandidate = async ({ candidate }) => {
      if (!candidate) return
      if (pcRef.current && remoteDescSetRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
        } catch(e) { console.warn('addIceCandidate error:', e) }
      } else {
        // Queue it — remote description not set yet
        iceCandidateQueueRef.current.push(candidate)
      }
    }

    const onCallEnded = () => { cleanup() }
    const onCallUnavailable = () => { cleanup() }

    socket.on('incoming_call', onIncomingCall)
    socket.on('call_answered', onCallAnswered)
    socket.on('call_rejected_response', onCallRejected)
    socket.on('ice_candidate', onIceCandidate)
    socket.on('call_ended', onCallEnded)
    socket.on('call_unavailable', onCallUnavailable)

    return () => {
      socket.off('incoming_call', onIncomingCall)
      socket.off('call_answered', onCallAnswered)
      socket.off('call_rejected_response', onCallRejected)
      socket.off('ice_candidate', onIceCandidate)
      socket.off('call_ended', onCallEnded)
      socket.off('call_unavailable', onCallUnavailable)
    }
  }, [callState, createPC, cleanup])

  // Expose startCall globally
  useEffect(() => {
    window.__fenixStartCall = startCall
    return () => { delete window.__fenixStartCall }
  }, [startCall])

  const formatDur = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (callState === 'idle') return <audio ref={remoteAudioRef} autoPlay playsInline />

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <div className="call-overlay">
        <div className="call-overlay__content">
          <div className={`call-overlay__avatar ${callState === 'calling' ? 'call-overlay__avatar--pulsing' : ''} ${callState === 'ringing' ? 'call-overlay__avatar--pulsing' : ''}`}>
            {remoteUser?.avatar ? (
              <img src={remoteUser.avatar} alt="" className="call-overlay__avatar-img" />
            ) : (
              <div className="call-overlay__avatar-fallback">
                {(remoteUser?.name || '?').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <h2 className="call-overlay__name">{remoteUser?.name || 'Usuario'}</h2>

          <div className="call-overlay__status">
            {callState === 'calling' && 'Llamando...'}
            {callState === 'ringing' && 'Llamada entrante...'}
            {callState === 'connected' && formatDur(duration)}
          </div>

          {callState === 'connected' && (
            <div className="call-overlay__wave">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="call-overlay__wave-bar" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}

          <div className="call-overlay__actions">
            {callState === 'ringing' ? (
              <>
                <button className="call-overlay__btn call-overlay__btn--reject" onClick={rejectCall}>
                  <PhoneOff size={24} />
                  <span>Rechazar</span>
                </button>
                <button className="call-overlay__btn call-overlay__btn--accept" onClick={answerCall}>
                  <Phone size={24} />
                  <span>Contestar</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className={`call-overlay__btn call-overlay__btn--mute ${isMuted ? 'call-overlay__btn--muted' : ''}`}
                  onClick={toggleMute}
                >
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                  <span>{isMuted ? 'Silenciado' : 'Silenciar'}</span>
                </button>
                <button className="call-overlay__btn call-overlay__btn--end" onClick={endCall}>
                  <PhoneOff size={24} />
                  <span>Colgar</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default CallOverlay
