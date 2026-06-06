import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './stores/authStore'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
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
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--color-bg-primary)',
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid var(--color-brand)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
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
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
      <Route path="/app/community/:id" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
