import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import api from '../lib/api'
import './AuthPage.css'

/**
 * ForgotPasswordPage — Solicitar recuperación de contraseña
 */
function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    setError('')

    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      setSent(true)
    } catch (err) {
      setError(err.message || 'Error al enviar el email')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__bg">
        <div className="auth-page__orb auth-page__orb--purple" />
        <div className="auth-page__orb auth-page__orb--cyan" />
      </div>

      <div className="auth-card">
        <div className="auth-card__logo">
          <Flame size={28} />
        </div>

        {sent ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
              <CheckCircle size={48} style={{ color: 'var(--color-online)', marginBottom: 12 }} />
            </div>
            <h1 className="auth-card__title">¡Revisa tu email!</h1>
            <p className="auth-card__subtitle">
              Si <strong>{email}</strong> está registrado, recibirás un link para restablecer tu contraseña.
            </p>
            <p className="auth-card__subtitle" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
              Revisa tu bandeja de spam si no lo ves en unos minutos.
            </p>
            <Link to="/login">
              <Button size="lg" className="auth-card__submit">
                Volver al login
              </Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="auth-card__title">Recuperar contraseña</h1>
            <p className="auth-card__subtitle">
              Ingresa tu email y te enviaremos un link para restablecer tu contraseña.
            </p>

            {error && <div className="auth-card__error">{error}</div>}

            <form className="auth-card__form" onSubmit={handleSubmit}>
              <Input
                label="Email"
                type="email"
                icon={<Mail size={18} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
              />
              <Button
                type="submit"
                size="lg"
                loading={isLoading}
                disabled={!email.trim()}
                className="auth-card__submit"
              >
                Enviar link de recuperación
              </Button>
            </form>

            <p className="auth-card__footer">
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={14} />
                Volver al login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ForgotPasswordPage
