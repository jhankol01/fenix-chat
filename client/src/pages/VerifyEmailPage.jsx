import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Flame, CheckCircle, XCircle, Loader } from 'lucide-react'
import api from '../lib/api.js'
import './AuthPage.css'

function VerifyEmailPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading, success, error
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function verify() {
      try {
        const data = await api.get(`/auth/verify/${token}`)
        setStatus('success')
        setMessage(data.message)
      } catch (err) {
        setStatus('error')
        setMessage(err.message || 'Token inválido o expirado')
      }
    }
    if (token) verify()
  }, [token])

  return (
    <div className="auth-page">
      <div className="auth-page__bg">
        <div className="auth-page__orb auth-page__orb--purple" />
        <div className="auth-page__orb auth-page__orb--cyan" />
      </div>

      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-card__logo">
          <Flame size={28} />
        </div>
        <h1 className="auth-card__title">Fenix Messenger</h1>

        {status === 'loading' && (
          <div style={{ marginTop: 32 }}>
            <Loader
              size={32}
              style={{
                color: 'var(--color-brand)',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 16 }}>
              Verificando tu email...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ marginTop: 32 }}>
            <CheckCircle size={48} style={{ color: 'var(--color-success)', marginBottom: 16 }} />
            <h2 style={{
              color: 'var(--color-success)',
              marginBottom: 8,
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-bold)',
            }}>
              ¡Verificado!
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24, fontSize: 'var(--text-sm)' }}>
              {message}
            </p>
            <button
              className="auth-card__submit"
              onClick={() => navigate('/login')}
              style={{
                padding: '12px 32px',
                background: 'var(--color-brand)',
                color: 'var(--color-text-inverse)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                fontWeight: 'var(--weight-bold)',
                cursor: 'pointer',
                fontSize: 'var(--text-base)',
                transition: 'all var(--transition-fast)',
                boxShadow: 'var(--shadow-glow-brand)',
              }}
            >
              Ir a Login
            </button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ marginTop: 32 }}>
            <XCircle size={48} style={{ color: 'var(--color-error)', marginBottom: 16 }} />
            <h2 style={{
              color: 'var(--color-error)',
              marginBottom: 8,
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-bold)',
            }}>
              Error
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24, fontSize: 'var(--text-sm)' }}>
              {message}
            </p>
            <button
              onClick={() => navigate('/register')}
              style={{
                padding: '12px 32px',
                background: 'transparent',
                color: 'var(--color-brand)',
                border: '1px solid var(--color-brand)',
                borderRadius: 'var(--radius-full)',
                fontWeight: 'var(--weight-bold)',
                cursor: 'pointer',
                fontSize: 'var(--text-base)',
                transition: 'all var(--transition-fast)',
              }}
            >
              Registrarse de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default VerifyEmailPage
