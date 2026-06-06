import { useNavigate } from 'react-router-dom'
import { Flame, MessageSquare, Volume2, Users } from 'lucide-react'
import Button from '../components/ui/Button'
import './LandingPage.css'

/**
 * Página de aterrizaje — Hero, features, footer.
 * Fondo con orbes animados y efecto phoenix.
 */
function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="landing">
      {/* Fondo animado con orbes */}
      <div className="landing__bg">
        <div className="landing__orb landing__orb--purple" />
        <div className="landing__orb landing__orb--cyan" />
        <div className="landing__orb landing__orb--orange" />
        <div className="landing__orb landing__orb--small-purple" />
      </div>

      {/* Phoenix glow sutil */}
      <div className="landing__phoenix-glow" />

      {/* Hero */}
      <section className="landing__hero">
        <div className="landing__logo">
          <Flame size={40} />
        </div>

        <h1 className="landing__title">Fénix Chat</h1>
        <p className="landing__subtitle">
          Mensajería simple con comunidades y salas de voz permanentes.
        </p>

        <div className="landing__cta">
          <Button size="lg" onClick={() => navigate('/register')}>
            Crear Cuenta
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/login')}>
            Iniciar Sesión
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="landing__features">
        <div className="landing__feature-card">
          <div className="landing__feature-icon landing__feature-icon--chat">
            <MessageSquare size={28} />
          </div>
          <h3 className="landing__feature-title">Chat en tiempo real</h3>
          <p className="landing__feature-desc">
            Mensajes instantáneos con soporte multimedia. Comunicación fluida y sin retrasos.
          </p>
        </div>

        <div className="landing__feature-card">
          <div className="landing__feature-icon landing__feature-icon--voice">
            <Volume2 size={28} />
          </div>
          <h3 className="landing__feature-title">Salas de voz permanentes</h3>
          <p className="landing__feature-desc">
            Entra y sal libremente de salas de voz siempre activas. Como estar en la misma habitación.
          </p>
        </div>

        <div className="landing__feature-card">
          <div className="landing__feature-icon landing__feature-icon--community">
            <Users size={28} />
          </div>
          <h3 className="landing__feature-title">Comunidades simples</h3>
          <p className="landing__feature-desc">
            Crea y organiza comunidades en segundos. Sin complicaciones, solo conexión.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing__footer">
        © {new Date().getFullYear()} Fénix Chat. Hecho con 🔥 para comunidades.
      </footer>
    </div>
  )
}

export default LandingPage
