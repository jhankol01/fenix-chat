import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Flame, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import api from '../lib/api'
import './AuthPage.css'

/**
 * ResetPasswordPage — Establecer nueva contraseña con token
 */
function ResetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setIsLoading(true)

    try {
      await api.post('/auth/reset-password', { token, password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message || 'Error al restablecer la contraseña')
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

        {success ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
              <CheckCircle size={48} style={{ color: 'var(--color-online)', marginBottom: 12 }} />
            </div>
            <h1 className="auth-card__title">¡Contraseña actualizada!</h1>
            <p className="auth-card__subtitle">
              Tu contraseña se ha restablecido correctamente. Redirigiendo al login...
            </p>
            <Link to="/login">
              <Button size="lg" className="auth-card__submit">
                Ir al login ahora
              </Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="auth-card__title">Nueva contraseña</h1>
            <p className="auth-card__subtitle">
              Ingresa tu nueva contraseña para restablecer el acceso.
            </p>

            {error && <div className="auth-card__error">{error}</div>}

            <form className="auth-card__form" onSubmit={handleSubmit}>
              <Input
                label="Nueva contraseña"
                type={showPassword ? 'text' : 'password'}
                icon={<Lock size={18} />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
              <Input
                label="Confirmar contraseña"
                type={showPassword ? 'text' : 'password'}
                icon={<Lock size={18} />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  alignSelf: 'flex-end',
                  marginTop: -8,
                }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPassword ? 'Ocultar' : 'Mostrar'} contraseña
              </button>
              <Button
                type="submit"
                size="lg"
                loading={isLoading}
                disabled={!password || !confirmPassword}
                className="auth-card__submit"
              >
                Restablecer contraseña
              </Button>
            </form>

            <p className="auth-card__footer">
              <Link to="/login">Volver al login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordPage
