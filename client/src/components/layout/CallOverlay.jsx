import { useState, useRef, useEffect, useCallback } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Volume2, Volume1 } from 'lucide-react'
import { getSocket } from '../../lib/socket'
import useAuthStore from '../../stores/authStore'
import './CallOverlay.css'

// Only STUN — proven to work, no broken TURN
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

function CallOverlay() {
  const [callState, setCallState] = useState('idle')
  const [remoteUser, setRemoteUser] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaker, setIsSpeaker] = useState(false)
  const [duration, setDuration] = useState(0)

  // Refs
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const durationTimerRef = useRef(null)
  const callerIdRef = useRef(null)
  const targetUserIdRef = useRef(null)
  const ringtoneRef = useRef(null)
  const pendingOfferRef = useRef(null)
  const iceCandidateQueueRef = useRef([])
  const remoteDescSetRef = useRef(false)
  const callStateRef = useRef('idle') // mirror of callState for socket callbacks

  // CRITICAL: Use a persistent Audio object that NEVER gets unmounted by React
  const remoteAudioRef = useRef(null)
  if (!remoteAudioRef.current) {
    remoteAudioRef.current = new Audio()
    remoteAudioRef.current.autoplay = true
  }

  const user = useAuthStore(s => s.user)

  // Keep callStateRef in sync
  useEffect(() => { callStateRef.current = callState }, [callState])

  // ─── Ringtone ───────────────────────────────────────────
  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      clearInterval(ringtoneRef.current.interval)
      try { ringtoneRef.current.ctx.close() } catch(e) {}
      ringtoneRef.current = null
    }
  }, [])

  const playTone = useCallback((type) => {
    stopRingtone()
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      if (type === 'outgoing') {
        const beep = () => {
          const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain()
          o1.frequency.value = 440; o2.frequency.value = 480
          o1.type = o2.type = 'sine'; g.gain.value = 0.08
          o1.connect(g); o2.connect(g); g.connect(ctx.destination)
          o1.start(); o2.start()
          o1.stop(ctx.currentTime + 1); o2.stop(ctx.currentTime + 1)
        }
        beep()
        ringtoneRef.current = { ctx, interval: setInterval(beep, 4000) }
      } else {
        const ring = () => {
          for (let i = 0; i < 2; i++) {
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.frequency.value = i === 0 ? 800 : 640; o.type = 'sine'
            g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.25)
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.2)
            o.connect(g); g.connect(ctx.destination)
            o.start(ctx.currentTime + i * 0.25)
            o.stop(ctx.currentTime + i * 0.25 + 0.2)
          }
        }
        ring()
        ringtoneRef.current = { ctx, interval: setInterval(ring, 2000) }
      }
    } catch(e) {}
  }, [stopRingtone])

  useEffect(() => {
    if (callState === 'calling') playTone('outgoing')
    else if (callState === 'ringing') playTone('incoming')
    else stopRingtone()
    return () => stopRingtone()
  }, [callState, playTone, stopRingtone])

  // ─── Cleanup ───────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null
      pcRef.current.onicecandidate = null
      pcRef.current.onconnectionstatechange = null
      pcRef.current.oniceconnectionstatechange = null
      if (pcRef.current._disconnectTimer) clearTimeout(pcRef.current._disconnectTimer)
      pcRef.current.close()
      pcRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    // Don't destroy the audio object, just disconnect it
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
    stopRingtone()
    setCallState('idle')
    setRemoteUser(null)
    setIsMuted(false)
    setIsSpeaker(false)
    setDuration(0)
    callerIdRef.current = null
    targetUserIdRef.current = null
    pendingOfferRef.current = null
    iceCandidateQueueRef.current = []
    remoteDescSetRef.current = false
  }, [stopRingtone])

  // ─── Flush queued ICE candidates ───────────────────────
  const flushIceCandidates = useCallback(async (pc) => {
    const queue = [...iceCandidateQueueRef.current]
    iceCandidateQueueRef.current = []
    console.log(`🧊 Flushing ${queue.length} queued ICE candidates`)
    for (const c of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch(e) {}
    }
  }, [])

  // ─── Create RTCPeerConnection ──────────────────────────
  const createPC = useCallback((remoteUserId) => {
    if (pcRef.current) {
      pcRef.current.close()
    }

    const pc = new RTCPeerConnection(ICE_CONFIG)
    pcRef.current = pc
    const socket = getSocket()

    // Send ICE candidates to remote
    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('ice_candidate', { targetUserId: remoteUserId, candidate: e.candidate })
      }
    }

    // CRITICAL: When remote track arrives, pipe it to the persistent Audio object
    pc.ontrack = (e) => {
      console.log('🔊 ontrack fired! streams:', e.streams.length, 'tracks:', e.track.kind)
      const audio = remoteAudioRef.current
      if (e.streams && e.streams[0]) {
        audio.srcObject = e.streams[0]
      } else {
        // Fallback: create a new stream from the track
        const stream = new MediaStream([e.track])
        audio.srcObject = stream
      }
      audio.play().then(() => {
        console.log('🔊 Audio playing!')
      }).catch(err => {
        console.warn('🔊 Audio play blocked:', err.message)
      })
    }

    // Connection state management
    pc.onconnectionstatechange = () => {
      console.log('📶 Connection:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        setCallState('connected')
        if (durationTimerRef.current) clearInterval(durationTimerRef.current)
        durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
        if (pc._disconnectTimer) { clearTimeout(pc._disconnectTimer); pc._disconnectTimer = null }
      }
      if (pc.connectionState === 'disconnected') {
        // Grace period — often recovers
        pc._disconnectTimer = setTimeout(() => {
          if (pcRef.current && pcRef.current.connectionState !== 'connected') {
            console.log('📶 Did not recover, ending')
            cleanup()
          }
        }, 10000)
      }
      if (pc.connectionState === 'failed') {
        if (!pc._restarted) {
          pc._restarted = true
          console.log('📶 ICE restart...')
          pc.restartIce()
        } else {
          cleanup()
        }
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE:', pc.iceConnectionState)
    }

    return pc
  }, [cleanup])

  // ─── Start Call (CALLER) ───────────────────────────────
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
      console.log('📞 Call sent to', targetUserId)
    } catch (err) {
      console.error('❌ startCall error:', err)
      cleanup()
    }
  }, [user, createPC, cleanup])

  // ─── Answer Call (RECEIVER) ────────────────────────────
  const answerCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const callerId = callerIdRef.current
      const offer = pendingOfferRef.current
      if (!offer) { console.error('No offer!'); cleanup(); return }

      // Create fresh PC for answering
      const pc = createPC(callerId)
      stream.getTracks().forEach(t => pc.addTrack(t, stream))

      // Set the caller's offer as remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      remoteDescSetRef.current = true
      console.log('📞 Remote description set (offer)')

      // Flush any ICE candidates that arrived while ringing
      await flushIceCandidates(pc)

      // Create and send answer
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
      console.log('✅ Answer sent')
    } catch (err) {
      console.error('❌ answerCall error:', err)
      cleanup()
    }
  }, [createPC, cleanup, flushIceCandidates, stopRingtone])

  // ─── Reject / End ──────────────────────────────────────
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
      if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled) }
    }
  }

  const toggleSpeaker = () => {
    const audio = remoteAudioRef.current
    if (audio) {
      const next = !isSpeaker
      setIsSpeaker(next)
      audio.volume = next ? 1.0 : 0.25
    }
  }

  // ─── Socket Listeners ─────────────────────────────────
  useEffect(() => {
    let cleanupFns = null

    const setupListeners = (socket) => {
      const onIncomingCall = ({ callerId, callerName, callerAvatar, offer }) => {
        console.log('📞 Incoming call from', callerName, 'caller:', callerId)
        if (callStateRef.current !== 'idle') {
          socket.emit('call_rejected', { callerId })
          return
        }
        callerIdRef.current = callerId
        pendingOfferRef.current = offer
        remoteDescSetRef.current = false
        iceCandidateQueueRef.current = []
        setRemoteUser({ name: callerName, avatar: callerAvatar })
        setCallState('ringing')
      }

      const onCallAnswered = async ({ answer }) => {
        console.log('📞 Remote answered!')
        const pc = pcRef.current
        if (!pc) return
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
          remoteDescSetRef.current = true
          console.log('📞 Remote description set (answer)')
          await flushIceCandidates(pc)
        } catch(e) {
          console.error('❌ setRemoteDescription error:', e)
        }
      }

      const onCallRejected = () => { cleanup() }

      const onIceCandidate = async ({ candidate }) => {
        if (!candidate) return
        const pc = pcRef.current
        if (pc && remoteDescSetRef.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          } catch(e) { console.warn('ICE add error:', e) }
        } else {
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

      console.log('📞 Call listeners registered!')

      return () => {
        socket.off('incoming_call', onIncomingCall)
        socket.off('call_answered', onCallAnswered)
        socket.off('call_rejected_response', onCallRejected)
        socket.off('ice_candidate', onIceCandidate)
        socket.off('call_ended', onCallEnded)
        socket.off('call_unavailable', onCallUnavailable)
      }
    }

    // Try to setup immediately, or poll until socket is available
    const trySetup = () => {
      const socket = getSocket()
      if (socket) {
        cleanupFns = setupListeners(socket)
        return true
      }
      return false
    }

    if (!trySetup()) {
      // Socket not ready yet — poll every 500ms
      const interval = setInterval(() => {
        if (trySetup()) clearInterval(interval)
      }, 500)
      return () => {
        clearInterval(interval)
        if (cleanupFns) cleanupFns()
      }
    }

    return () => {
      if (cleanupFns) cleanupFns()
    }
  }, [cleanup, flushIceCandidates])
  // ↑ NO callState dependency! Use callStateRef instead

  // Expose startCall
  useEffect(() => {
    window.__fenixStartCall = startCall
    return () => { delete window.__fenixStartCall }
  }, [startCall])

  const fmt = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`

  if (callState === 'idle') return null

  return (
    <div className="call-overlay">
      <div className="call-overlay__content">
        <div className={`call-overlay__avatar ${callState !== 'connected' ? 'call-overlay__avatar--pulsing' : ''}`}>
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
          {callState === 'connected' && fmt(duration)}
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
                className={`call-overlay__btn call-overlay__btn--speaker ${isSpeaker ? 'call-overlay__btn--speaker-on' : ''}`}
                onClick={toggleSpeaker}
              >
                {isSpeaker ? <Volume2 size={22} /> : <Volume1 size={22} />}
                <span>{isSpeaker ? 'Alta voz' : 'Normal'}</span>
              </button>
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
  )
}

export default CallOverlay
