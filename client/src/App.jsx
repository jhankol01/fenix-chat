import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './stores/authStore'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AppLayout from './pages/AppLayout'

/**
 * Ruta protegida — redirige a /login si no está autenticado.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0a0f1c',
        gap: '16px',
      }}>
        <div style={{
          width: 48,
          height: 48,
          border: '3px solid #00F5FF',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: '#8899aa', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
          Cargando Fénix Chat...
        </p>
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

/**
 * Ruta pública — redirige a /app si ya está autenticado.
 */
function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return null
  return isAuthenticated ? <Navigate to="/app" replace /> : children
}

/**
 * Fénix Chat — Router principal
 * Rutas públicas, protegidas y verificación de email.
 */
function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/verify/:token" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
      <Route path="/app/community/:id" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
