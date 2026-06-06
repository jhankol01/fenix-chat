import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Flame, Mail, Lock } from 'lucide-react'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import useAuthStore from '../stores/authStore'
import './AuthPage.css'
import './LoginPage.css'

/**
 * Página de inicio de sesión — tarjeta glass centrada.
 */
function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email: form.email, password: form.password })
      navigate('/app', { replace: true })
    } catch (err) {
      if (err.data?.code === 'EMAIL_NOT_VERIFIED') {
        setError('Verifica tu email primero. Revisa tu bandeja de entrada.')
      } else {
        setError(err.message || 'Error al iniciar sesión')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Orbes de fondo */}
      <div className="auth-page__bg">
        <div className="auth-page__orb auth-page__orb--purple" />
        <div className="auth-page__orb auth-page__orb--cyan" />
      </div>

      <div className="auth-card">
        <div className="auth-card__logo">
          <Flame size={28} />
        </div>

        <h1 className="auth-card__title">Bienvenido de vuelta</h1>
        <p className="auth-card__subtitle">
          Inicia sesión para continuar en Fénix Chat
        </p>

        {error && <div className="auth-card__error">{error}</div>}

        <form className="auth-card__form" onSubmit={handleSubmit}>
          <Input
            label="Email o nombre de usuario"
            type="text"
            icon={<Mail size={18} />}
            value={form.email}
            onChange={handleChange('email')}
            autoComplete="email"
          />
          <Input
            label="Contraseña"
            type="password"
            icon={<Lock size={18} />}
            value={form.password}
            onChange={handleChange('password')}
            autoComplete="current-password"
          />
          <Button
            type="submit"
            size="lg"
            loading={loading}
            className="auth-card__submit"
          >
            Iniciar Sesión
          </Button>
        </form>

        <p className="auth-card__footer" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
          <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
        </p>

        <p className="auth-card__footer">
          ¿No tienes cuenta?{' '}
          <Link to="/register">Regístrate</Link>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
