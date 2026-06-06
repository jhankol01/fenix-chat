import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Global error handler to show crash errors visibly
window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `
      <div style="padding:40px;color:#ff6b6b;font-family:monospace;background:#0a0f1c;min-height:100vh;">
        <h2>⚠️ Error de carga</h2>
        <pre style="white-space:pre-wrap;color:#ccc;">${e.message}\n${e.filename}:${e.lineno}</pre>
        <button onclick="localStorage.clear();location.href='/login'" style="margin-top:20px;padding:12px 24px;background:#00F5FF;color:#000;border:none;border-radius:8px;cursor:pointer;font-size:16px;">
          Reiniciar sesión
        </button>
      </div>
    `
  }
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason)
})

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
} catch (err) {
  document.getElementById('root').innerHTML = `
    <div style="padding:40px;color:#ff6b6b;font-family:monospace;background:#0a0f1c;min-height:100vh;">
      <h2>⚠️ Error de inicio</h2>
      <pre style="white-space:pre-wrap;color:#ccc;">${err.message}\n${err.stack}</pre>
      <button onclick="localStorage.clear();location.href='/login'" style="margin-top:20px;padding:12px 24px;background:#00F5FF;color:#000;border:none;border-radius:8px;cursor:pointer;font-size:16px;">
        Reiniciar sesión
      </button>
    </div>
  `
}
