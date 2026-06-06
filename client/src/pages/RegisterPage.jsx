import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Flame, User, Mail, Lock, ArrowLeft, CheckCircle } from 'lucide-react'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import useAuthStore from '../stores/authStore'
import './AuthPage.css'
import './RegisterPage.css'

/**
 * Página de registro — flujo de 2 pasos:
 * 1. Datos de cuenta (username, email, password)
 * 2. Confirmación de email enviado
 */
function RegisterPage() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)

  // --- Estado del formulario ---
  const [step, setStep] = useState(1)
  const [animating, setAnimating] = useState(false)
  const [slideDirection, setSlideDirection] = useState('next') // 'next' o 'back'

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resent, setResent] = useState(false)

  // --- Handlers del paso 1 ---
  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validateStep1 = () => {
    const newErrors = {}
    if (!form.username.trim()) newErrors.username = 'El nombre de usuario es requerido'
    if (!form.email.trim()) newErrors.email = 'El email es requerido'
    if (form.password.length < 6) newErrors.password = 'Mínimo 6 caracteres'
    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleStep1Submit = async (e) => {
    e.preventDefault()
    if (!validateStep1()) return
    setError('')
    setLoading(true)
    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
      })
      goToStep(2)
    } catch (err) {
      setError(err.message || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  // --- Transición entre pasos ---
  const goToStep = (newStep) => {
    setSlideDirection(newStep > step ? 'next' : 'back')
    setAnimating(true)
    // Pequeño delay para que el CSS haga la transición de salida
    setTimeout(() => {
      setStep(newStep)
      setAnimating(false)
    }, 250)
  }

  // --- Handlers del paso 2 ---
  const handleBack = () => {
    goToStep(1)
    setError('')
    setResent(false)
  }

  const handleResendEmail = () => {
    setResent(true)
    // Feedback visual temporal
    setTimeout(() => setResent(false), 3000)
  }

  // Email parcialmente enmascarado para el paso 2
  const maskedEmail = (() => {
    const [local, domain] = form.email.split('@')
    if (!local || !domain) return form.email
    const visibleStart = local.slice(0, 2)
    const visibleEnd = local.length > 3 ? local.slice(-1) : ''
    return `${visibleStart}${'•'.repeat(Math.max(local.length - 3, 1))}${visibleEnd}@${domain}`
  })()

  // Clase de animación
  const stepClass = animating
    ? `register-step register-step--exit-${slideDirection}`
    : 'register-step register-step--enter'

  return (
    <div className="auth-page">
      {/* Orbes de fondo */}
      <div className="auth-page__bg">
        <div className="auth-page__orb auth-page__orb--purple" />
        <div className="auth-page__orb auth-page__orb--cyan" />
      </div>

      <div className="auth-card register-card">
        {/* Logo */}
        <div className="auth-card__logo">
          <Flame size={28} />
        </div>

        {/* Indicador de pasos */}
        <div className="register-steps">
          <div className={`register-steps__dot ${step >= 1 ? 'register-steps__dot--active' : ''}`} />
          <div className="register-steps__line">
            <div className={`register-steps__line-fill ${step >= 2 ? 'register-steps__line-fill--active' : ''}`} />
          </div>
          <div className={`register-steps__dot ${step >= 2 ? 'register-steps__dot--active' : ''}`} />
        </div>

        {/* ======= PASO 1: Datos de cuenta ======= */}
        {step === 1 && (
          <div className={stepClass}>
            <h1 className="auth-card__title">Crear Cuenta</h1>
            <p className="auth-card__subtitle">
              Únete a la comunidad Fénix Chat
            </p>

            {error && <div className="auth-card__error">{error}</div>}

            <form className="auth-card__form" onSubmit={handleStep1Submit}>
              <Input
                label="Nombre de usuario"
                type="text"
                icon={<User size={18} />}
                value={form.username}
                onChange={handleChange('username')}
                error={errors.username}
                autoComplete="username"
              />
              <Input
                label="Email"
                type="email"
                icon={<Mail size={18} />}
                value={form.email}
                onChange={handleChange('email')}
                error={errors.email}
                autoComplete="email"
              />
              <Input
                label="Contraseña"
                type="password"
                icon={<Lock size={18} />}
                value={form.password}
                onChange={handleChange('password')}
                error={errors.password}
                autoComplete="new-password"
              />
              <Input
                label="Confirmar contraseña"
                type="password"
                icon={<Lock size={18} />}
                value={form.confirmPassword}
                onChange={handleChange('confirmPassword')}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />
              <Button
                type="submit"
                size="lg"
                loading={loading}
                className="auth-card__submit"
              >
                Continuar
              </Button>
            </form>

            <p className="auth-card__footer">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login">Inicia Sesión</Link>
            </p>
          </div>
        )}

        {/* ======= PASO 2: Confirmación de email enviado ======= */}
        {step === 2 && (
          <div className={stepClass}>
            <div className="register-verify">
              {/* Botón volver */}
              <button
                type="button"
                className="register-verify__back"
                onClick={handleBack}
              >
                <ArrowLeft size={16} />
                <span>Volver</span>
              </button>

              {/* Ícono de email */}
              <div className="register-verify__icon">
                <Mail size={32} />
              </div>

              <h2 className="register-verify__title">Revisa tu email</h2>
              <p className="register-verify__text">
                Hemos enviado un link de verificación a:
              </p>
              <p className="register-verify__phone">{maskedEmail}</p>

              <p className="register-verify__text" style={{ marginTop: 'var(--space-4)' }}>
                Haz click en el link para activar tu cuenta
              </p>

              {/* Botón ir a login */}
              <Button
                type="button"
                size="lg"
                className="register-verify__submit"
                onClick={() => navigate('/login')}
              >
                Ir a Login
              </Button>

              {/* Reenviar email */}
              <div className="register-verify__resend">
                <span className="register-verify__resend-text">
                  ¿No recibiste el email?
                </span>
                <button
                  type="button"
                  className="register-verify__resend-btn"
                  onClick={handleResendEmail}
                >
                  {resent ? '¡Enviado!' : 'Reenviar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RegisterPage
