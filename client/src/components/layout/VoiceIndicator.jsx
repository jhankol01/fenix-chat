import { Mic, MicOff, PhoneOff, Volume2, Signal } from 'lucide-react'
import useVoiceStore from '../../stores/voiceStore'
import './VoiceIndicator.css'

function VoiceIndicator({ onGoToVoice }) {
  const { inVoiceRoom, roomName, communityName, isMuted, participantCount } = useVoiceStore()

  if (!inVoiceRoom) return null

  return (
    <div className="voice-indicator">
      <div className="voice-indicator__pulse" />
      <div className="voice-indicator__info" onClick={onGoToVoice}>
        <div className="voice-indicator__status">
          <Signal size={14} className="voice-indicator__signal" />
          <span className="voice-indicator__label">Voz Conectada</span>
        </div>
        <div className="voice-indicator__details">
          <Volume2 size={12} />
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
      <div className="voice-indicator__controls">
        <button
          className={`voice-indicator__btn ${isMuted ? 'voice-indicator__btn--muted' : ''}`}
          onClick={() => {
            // Dispatch custom event so CommunityDesktop can handle it
            window.dispatchEvent(new CustomEvent('voice-toggle-mute'))
          }}
          title={isMuted ? 'Activar micrófono' : 'Silenciar'}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <button
          className="voice-indicator__btn voice-indicator__btn--leave"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('voice-leave'))
          }}
          title="Desconectar"
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  )
}

export default VoiceIndicator
