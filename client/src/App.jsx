import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import useAuthStore from './stores/authStore'
import { ToastContainer } from './components/ui/Toast'
import ConnectionStatus from './components/ui/ConnectionStatus'

/* ── Lazy-loaded pages (code-splitting) ── */
const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const AppLayout = lazy(() => import('./pages/AppLayout'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))

/**
 * Suspense fallback — Fenix branded loading spinner
 */
function FenixLoader() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#08081A',
      gap: '16px',
    }}>
      <div style={{
        width: 48,
        height: 48,
        border: '3px solid #7C3AED',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <p style={{ color: '#9B8E7E', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
        Cargando Fenix...
      </p>
    </div>
  )
}

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
          Cargando Fenix...
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
 * Fenix Messenger — Router principal
 * Rutas públicas, protegidas y verificación de email.
 */
function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <>
      <ToastContainer />
      <ConnectionStatus />
      <Suspense fallback={<FenixLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/verify/:token" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password/:token" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
          <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          <Route path="/app/community/:id" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App
