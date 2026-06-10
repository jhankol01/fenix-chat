import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PhoenixIcon from '../components/ui/PhoenixIcon'
import Button from '../components/ui/Button'
import './LandingPage.css'

/**
 * Página de aterrizaje — Premium gaming community landing.
 * Hero con logo, tagline, 6 feature cards con glassmorphism, y CTA.
 * Incluye: floating navbar, sección "¿Qué es?", stats, y footer expandido.
 */
function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  /* --- Scroll listener para navbar glassmorphism --- */
  useEffect(() => {
    const container = document.querySelector('.landing')
    if (!container) return

    const handleScroll = () => {
      setScrolled(container.scrollTop > 40)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

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

  const whatCards = [
    {
      emoji: '🎯',
      title: 'Simplicidad',
      desc: 'Sin configuraciones complejas. Crea tu comunidad y empieza a chatear en segundos.',
    },
    {
      emoji: '🌐',
      title: 'Comunidades',
      desc: 'Tu espacio permanente para reunir a tu grupo, con chat y voz siempre disponible.',
    },
    {
      emoji: '🎙️',
      title: 'Voz Permanente',
      desc: 'Salas de voz que siempre están abiertas. Entra, habla, y sal cuando quieras.',
    },
  ]

  const stats = [
    {
      emoji: '🔥',
      title: 'Chat Premium',
      subtitle: 'Mensajería en tiempo real',
    },
    {
      emoji: '🎙️',
      title: 'Voz 24/7',
      subtitle: 'Salas siempre activas',
    },
    {
      emoji: '🛡️',
      title: 'Seguridad',
      subtitle: 'Tu privacidad es prioridad',
    },
  ]

  /** Cierra el menú móvil y navega al anchor */
  const handleAnchor = (hash) => {
    setMenuOpen(false)
    const el = document.querySelector(hash)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing">
      {/* ====== Floating Navbar ====== */}
      <nav
        className={`landing__navbar${scrolled ? ' landing__navbar--scrolled' : ''}`}
      >
        <div className="landing__navbar-inner">
          {/* Logo */}
          <a
            href="#hero"
            className="landing__navbar-brand"
            onClick={(e) => { e.preventDefault(); handleAnchor('#hero') }}
          >
            <PhoenixIcon size={26} variant="fire" glow />
            <span className="landing__navbar-name">Fenix Messenger</span>
          </a>

          {/* Centro: links (desktop) */}
          <div className="landing__navbar-links">
            <a
              href="#hero"
              className="landing__navbar-link"
              onClick={(e) => { e.preventDefault(); handleAnchor('#hero') }}
            >
              Inicio
            </a>
            <a
              href="#features"
              className="landing__navbar-link"
              onClick={(e) => { e.preventDefault(); handleAnchor('#features') }}
            >
              Funciones
            </a>
          </div>

          {/* Derecha: CTA (desktop) */}
          <div className="landing__navbar-actions">
            <Button variant="secondary" size="sm" onClick={() => navigate('/login')}>
              Iniciar Sesión
            </Button>
            <Button size="sm" onClick={() => navigate('/register')}>
              Registrarse
            </Button>
          </div>

          {/* Hamburger (mobile) */}
          <button
            className={`landing__hamburger${menuOpen ? ' landing__hamburger--open' : ''}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Menú"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* Mobile slide menu */}
        <div className={`landing__mobile-menu${menuOpen ? ' landing__mobile-menu--open' : ''}`}>
          <a
            href="#hero"
            className="landing__mobile-link"
            onClick={(e) => { e.preventDefault(); handleAnchor('#hero') }}
          >
            Inicio
          </a>
          <a
            href="#features"
            className="landing__mobile-link"
            onClick={(e) => { e.preventDefault(); handleAnchor('#features') }}
          >
            Funciones
          </a>
          <div className="landing__mobile-actions">
            <Button variant="secondary" size="sm" onClick={() => { setMenuOpen(false); navigate('/login') }}>
              Iniciar Sesión
            </Button>
            <Button size="sm" onClick={() => { setMenuOpen(false); navigate('/register') }}>
              Registrarse
            </Button>
          </div>
        </div>
      </nav>

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
      <section id="hero" className="landing__hero">
        <div className="landing__logo">
          <PhoenixIcon size={44} variant="fire" glow />
        </div>

        <h1 className="landing__title">
          Fenix Messenger <span className="landing__title-fire">🔥</span>
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

      {/* ====== ¿Qué es Fenix Chat? ====== */}
      <section className="landing__what-section">
        <h2 className="landing__what-heading">
          Más simple que Discord. Más comunitaria que WhatsApp.
        </h2>
        <div className="landing__what-grid">
          {whatCards.map((card) => (
            <div key={card.title} className="landing__what-card">
              <div className="landing__what-emoji">{card.emoji}</div>
              <h3 className="landing__what-title">{card.title}</h3>
              <p className="landing__what-desc">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing__features">
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

      {/* ====== Stats / Social Proof ====== */}
      <section className="landing__stats">
        <div className="landing__stats-grid">
          {stats.map((stat) => (
            <div key={stat.title} className="landing__stat-card">
              <div className="landing__stat-emoji">{stat.emoji}</div>
              <h3 className="landing__stat-title">{stat.title}</h3>
              <p className="landing__stat-subtitle">{stat.subtitle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ====== Expanded Footer ====== */}
      <footer className="landing__footer">
        {/* Gradient divider */}
        <div className="landing__footer-divider" />

        <div className="landing__footer-grid">
          {/* Column 1: Branding */}
          <div className="landing__footer-col">
            <div className="landing__footer-brand">
              <PhoenixIcon size={22} variant="brand" />
              <span>Fenix Messenger</span>
            </div>
            <p className="landing__footer-tagline">
              Tu comunidad. Tu espacio. Tus reglas.
            </p>
            <p className="landing__footer-desc">
              La plataforma de comunidades que combina chat, voz y video en un solo lugar. Hecho con 🔥 para comunidades.
            </p>
          </div>

          {/* Column 2: Producto */}
          <div className="landing__footer-col">
            <h4 className="landing__footer-heading">Producto</h4>
            <ul className="landing__footer-list">
              <li><a href="#features" onClick={(e) => { e.preventDefault(); handleAnchor('#features') }}>Funciones</a></li>
              <li><a href="#features">Comunidades</a></li>
              <li><a href="#features">Salas de Voz</a></li>
              <li><a href="#features">Seguridad</a></li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div className="landing__footer-col">
            <h4 className="landing__footer-heading">Legal</h4>
            <ul className="landing__footer-list">
              <li><a href="#terms">Términos</a></li>
              <li><a href="#privacy">Privacidad</a></li>
              <li><a href="#contact">Contacto</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="landing__footer-bottom">
          <p className="landing__footer-copy">
            © {new Date().getFullYear()} Fenix Messenger. Todos los derechos reservados.
          </p>
          <div className="landing__footer-socials">
            <span className="landing__footer-social" aria-label="Twitter">𝕏</span>
            <span className="landing__footer-social" aria-label="GitHub">⌨</span>
            <span className="landing__footer-social" aria-label="Discord">🎮</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
