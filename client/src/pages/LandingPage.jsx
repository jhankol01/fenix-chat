import { useNavigate } from 'react-router-dom'
import { Flame } from 'lucide-react'
import Button from '../components/ui/Button'
import './LandingPage.css'

/**
 * Página de aterrizaje — Premium gaming community landing.
 * Hero con logo, tagline, 6 feature cards con glassmorphism, y CTA.
 */
function LandingPage() {
  const navigate = useNavigate()

  const features = [
    {
      emoji: '💬',
      title: 'Chat Premium',
      desc: 'Mensajes, notas de voz, emojis y más',
      delay: '0.1s',
    },
    {
      emoji: '📹',
      title: 'Videollamadas HD',
      desc: 'Llamadas de voz y video cristalinas',
      delay: '0.15s',
    },
    {
      emoji: '🎮',
      title: 'Comunidades',
      desc: 'Crea tu comunidad gaming',
      delay: '0.2s',
    },
    {
      emoji: '🎙️',
      title: 'Salas de Voz',
      desc: 'Voz permanente para tu grupo',
      delay: '0.25s',
    },
    {
      emoji: '📅',
      title: 'Eventos',
      desc: 'Organiza torneos y streams',
      delay: '0.3s',
    },
    {
      emoji: '🔒',
      title: 'Privacidad',
      desc: 'Cifrado de extremo a extremo',
      delay: '0.35s',
    },
  ]

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

      {/* Decorative grid lines */}
      <div className="landing__grid-overlay" />

      {/* Hero */}
      <section className="landing__hero">
        <div className="landing__logo">
          <Flame size={44} />
        </div>

        <h1 className="landing__title">
          Fénix Chat <span className="landing__title-fire">🔥</span>
        </h1>
        <p className="landing__tagline">
          Comunidades. Chat. Voz. Todo en un solo lugar.
        </p>

        <div className="landing__cta">
          <Button size="lg" onClick={() => navigate('/register')}>
            Comenzar ahora
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/login')}>
            Iniciar Sesión
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="landing__features">
        <h2 className="landing__features-heading">
          Todo lo que necesitas
        </h2>
        <div className="landing__features-grid">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="landing__feature-card"
              style={{ animationDelay: feature.delay }}
            >
              <div className="landing__feature-emoji">
                {feature.emoji}
              </div>
              <h3 className="landing__feature-title">{feature.title}</h3>
              <p className="landing__feature-desc">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing__footer">
        <div className="landing__footer-brand">
          <Flame size={18} className="landing__footer-icon" />
          <span>Fénix Chat</span>
        </div>
        <p className="landing__footer-tagline">
          Tu comunidad. Tu espacio. Tus reglas.
        </p>
        <p className="landing__footer-copy">
          © {new Date().getFullYear()} Fénix Chat. Hecho con 🔥 para comunidades.
        </p>
      </footer>
    </div>
  )
}

export default LandingPage
