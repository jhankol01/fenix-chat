import { useState, useEffect } from 'react'
import { Mic, MicOff, PhoneOff, Volume2, Signal, Timer } from 'lucide-react'
import useVoiceStore from '../../stores/voiceStore'
import './VoiceIndicator.css'

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function VoiceIndicator({ onGoToVoice }) {
  const { inVoiceRoom, roomName, communityName, isMuted, participantCount, joinedAt } = useVoiceStore()
  const [elapsed, setElapsed] = useState(0)

  // Timer tick every second
  useEffect(() => {
    if (!joinedAt) { setElapsed(0); return }
    setElapsed(Date.now() - joinedAt)
    const interval = setInterval(() => {
      setElapsed(Date.now() - joinedAt)
    }, 1000)
    return () => clearInterval(interval)
  }, [joinedAt])

  if (!inVoiceRoom) return null

  return (
    <div className="voice-indicator" onClick={onGoToVoice}>
      <div className="voice-indicator__pulse" />
      
      {/* Left: signal icon */}
      <div className="voice-indicator__icon-wrap">
        <Signal size={18} className="voice-indicator__signal" />
      </div>

      {/* Center: info */}
      <div className="voice-indicator__info">
        <div className="voice-indicator__status">
          <span className="voice-indicator__label">Voz Conectada</span>
          <div className="voice-indicator__timer">
            <Timer size={11} />
            <span>{formatDuration(elapsed)}</span>
          </div>
        </div>
        <div className="voice-indicator__details">
          <Volume2 size={11} />
          <span>{roomName}</span>
          <span className="voice-indicator__sep">·</span>
          <span>{communityName}</span>
          {participantCount > 1 && (
            <>
              <span className="voice-indicator__sep">·</span>
              <span>{participantCount} 👥</span>
            </>
          )}
        </div>
      </div>

      {/* Right: controls */}
      <div className="voice-indicator__controls" onClick={e => e.stopPropagation()}>
        <button
          className={`voice-indicator__btn ${isMuted ? 'voice-indicator__btn--muted' : ''}`}
          onClick={() => window.dispatchEvent(new CustomEvent('voice-toggle-mute'))}
          title={isMuted ? 'Activar micrófono' : 'Silenciar'}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <button
          className="voice-indicator__btn voice-indicator__btn--leave"
          onClick={() => window.dispatchEvent(new CustomEvent('voice-leave'))}
          title="Desconectar"
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  )
}

export default VoiceIndicator
