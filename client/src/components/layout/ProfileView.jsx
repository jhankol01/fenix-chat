import { useState, useRef, useEffect } from 'react'
import {
  User, Bell, Lock, Settings, ChevronRight, Camera, LogOut,
  ArrowLeft, Check, X, Moon, Globe, Trash2, Info, Palette, ImageIcon, Upload,
  Monitor, Smartphone, AlertTriangle, ExternalLink
} from 'lucide-react'
import useAuthStore from '../../stores/authStore'
import api from '../../lib/api'
import { NOTIFICATION_SOUNDS, previewSound } from '../../lib/notifications'
import './ProfileView.css'

/**
 * ProfileView — Pantalla de perfil del usuario (tab "Yo")
 * Muestra avatar, nombre, estado, y opciones de menú con subpantallas
 */
// Preset background options
const CHAT_BG_PRESETS = [
  { id: 'default', label: 'Predeterminado', value: 'default', css: 'var(--color-bg-primary)' },
  { id: 'fenix-dark', label: 'Fenix Oscuro', value: 'fenix-dark', css: 'url(/backgrounds/fenix-dark.png) center/cover' },
  { id: 'fenix-light', label: 'Fenix Claro', value: 'fenix-light', css: 'url(/backgrounds/fenix-light.png) center/cover' },
  { id: 'gradient-1', label: 'Púrpura profundo', value: 'gradient-1', css: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
  { id: 'gradient-2', label: 'Azul medianoche', value: 'gradient-2', css: 'linear-gradient(135deg, #141E30, #243B55)' },
  { id: 'gradient-3', label: 'Océano oscuro', value: 'gradient-3', css: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)' },
  { id: 'gradient-4', label: 'Fenix púrpura', value: 'gradient-4', css: 'linear-gradient(135deg, #2d1b69, #11001c)' },
  { id: 'gradient-5', label: 'Ahumado', value: 'gradient-5', css: 'linear-gradient(135deg, #1f1c2c, #928DAB)' },
  { id: 'gradient-6', label: 'Oscuro puro', value: 'gradient-6', css: 'linear-gradient(135deg, #0a0a0a, #1a1a1a)' },
]

// Color theme definitions
const THEMES = {
  fenix:   { id: 'fenix',   label: 'Fenix',         brand: '#7C3AED', light: '#A855F7', dark: '#6D28D9' },
  ocean:   { id: 'ocean',   label: 'Ocean Blue',     brand: '#0ea5e9', light: '#38bdf8', dark: '#0284c7' },
  emerald: { id: 'emerald', label: 'Emerald Green',   brand: '#10b981', light: '#34d399', dark: '#059669' },
  rose:    { id: 'rose',    label: 'Rose Pink',       brand: '#f43f5e', light: '#fb7185', dark: '#e11d48' },
  amber:   { id: 'amber',   label: 'Amber Gold',      brand: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
}
const THEME_LIST = Object.values(THEMES)

function getBackgroundCSS(chatBg) {
  if (!chatBg || chatBg === 'default') return null
  const preset = CHAT_BG_PRESETS.find(p => p.id === chatBg)
  if (preset) return preset.css
  // Custom URL
  if (chatBg.startsWith('http')) return chatBg
  return null
}

function ProfileView() {
  const [activePanel, setActivePanel] = useState(null) // null | 'editProfile' | 'notifications' | 'privacy' | 'settings' | 'chatBackground' | 'colorTheme'
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [showNotifHelpModal, setShowNotifHelpModal] = useState(false)
  const fileInputRef = useRef(null)
  const bgFileInputRef = useRef(null)

  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)
  const setUser = useAuthStore(state => state.setUser)

  // Edit profile state
  const [editForm, setEditForm] = useState({
    displayName: '',
    statusText: '',
    statusEmoji: '',
  })

  // Chat background state
  const [selectedBg, setSelectedBg] = useState('default')
  const [savedBg, setSavedBg] = useState('default')
  const [bgUploading, setBgUploading] = useState(false)

  // Color theme state
  const [selectedTheme, setSelectedTheme] = useState('fenix')
  const [savedTheme, setSavedTheme] = useState('fenix')

  // Privacy state (persisted in localStorage)
  const [privacyLastSeen, setPrivacyLastSeen] = useState(() => localStorage.getItem('fenix_privacy_lastseen') !== 'false')
  const [privacyReadReceipts, setPrivacyReadReceipts] = useState(() => localStorage.getItem('fenix_privacy_readreceipts') !== 'false')
  const [privacyProfileInfo, setPrivacyProfileInfo] = useState(() => localStorage.getItem('fenix_privacy_profileinfo') !== 'false')

  // Load saved preferences (background + theme)
  useEffect(() => {
    api.get('/preferences').then(data => {
      const bg = data?.preferences?.chat_bg || 'default'
      setSelectedBg(bg)
      setSavedBg(bg)
      const theme = data?.preferences?.theme || 'fenix'
      setSelectedTheme(theme)
      setSavedTheme(theme)
    }).catch(() => {})
  }, [])

  // Notification settings (local)
  const [notifSettings, setNotifSettings] = useState(() => {
    const saved = localStorage.getItem('fenix_notif_settings')
    if (saved) try { return JSON.parse(saved) } catch(_) {}
    return {
      sound: true,
      browserNotif: typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted',
      messagePreview: true,
    }
  })

  // Persist notif settings changes
  useEffect(() => {
    localStorage.setItem('fenix_notif_settings', JSON.stringify(notifSettings))
  }, [notifSettings])

  const menuItems = [
    { id: 'editProfile', icon: User, label: 'Editar perfil', color: '#00F5FF' },
    { id: 'chatBackground', icon: ImageIcon, label: 'Fondo de chat', color: '#A855F7' },
    { id: 'colorTheme', icon: Palette, label: 'Tema de color', color: '#00F5FF' },
    { id: 'notifications', icon: Bell, label: 'Notificaciones', color: '#FFD93D' },
    { id: 'privacy', icon: Lock, label: 'Privacidad', color: '#6C63FF' },
    { id: 'settings', icon: Settings, label: 'Configuración', color: '#FF6B6B' },
  ]

  const getInitials = (name) => {
    if (!name) return '?'
    return name.slice(0, 2).toUpperCase()
  }

  // Open edit profile panel
  const handleOpenEdit = () => {
    setEditForm({
      displayName: user?.display_name || user?.displayName || '',
      statusText: user?.status_text || user?.statusText || '',
      statusEmoji: user?.status_emoji || user?.statusEmoji || '',
    })
    setActivePanel('editProfile')
    setSaveMsg('')
  }

  // Save profile changes
  const handleSaveProfile = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const data = await api.patch('/users/me', {
        displayName: editForm.displayName,
        statusText: editForm.statusText,
        statusEmoji: editForm.statusEmoji,
      })
      // Update the user in auth store
      if (setUser) {
        setUser({
          ...user,
          display_name: data.displayName,
          displayName: data.displayName,
          status_text: data.statusText,
          statusText: data.statusText,
          status_emoji: data.statusEmoji,
          statusEmoji: data.statusEmoji,
          avatar_url: data.avatarUrl,
          avatarUrl: data.avatarUrl,
        })
      }
      setSaveMsg('✅ Perfil actualizado')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err) {
      setSaveMsg('❌ Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Handle avatar upload
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setSaveMsg('❌ La imagen debe ser menor a 5MB')
      return
    }

    try {
      setSaving(true)
      setSaveMsg('Subiendo foto...')
      const formData = new FormData()
      formData.append('avatar', file)
      const data = await api.upload('/upload/avatar', formData)
      if (setUser) {
        setUser({ ...user, avatar_url: data.avatarUrl, avatarUrl: data.avatarUrl })
      }
      setSaveMsg('✅ Foto actualizada')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err) {
      setSaveMsg('❌ Error al subir foto')
    } finally {
      setSaving(false)
    }
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout()
    } catch (err) {
      // Force logout on error
      localStorage.clear()
      window.location.href = '/login'
    }
  }

  // Toggle notification permission
  const handleToggleBrowserNotif = async () => {
    if (!('Notification' in window)) return

    // If currently enabled, just turn off locally
    if (notifSettings.browserNotif) {
      setNotifSettings(prev => ({ ...prev, browserNotif: false }))
      return
    }

    const permission = Notification.permission

    if (permission === 'default') {
      // Never asked yet — show the browser prompt
      const result = await Notification.requestPermission()
      setNotifSettings(prev => ({ ...prev, browserNotif: result === 'granted' }))
      if (result === 'denied') {
        // They just denied it — show the help modal immediately
        setShowNotifHelpModal(true)
      }
    } else if (permission === 'denied') {
      // Already blocked — show help modal with instructions
      setShowNotifHelpModal(true)
    } else if (permission === 'granted') {
      setNotifSettings(prev => ({ ...prev, browserNotif: true }))
    }
  }

  // Save chat background preference
  const handleSaveBg = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      await api.patch('/preferences', { chat_bg: selectedBg })
      setSavedBg(selectedBg)
      setSaveMsg('✅ Fondo guardado')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err) {
      setSaveMsg('❌ Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Save color theme preference
  const handleSaveTheme = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      await api.patch('/preferences', { theme: selectedTheme })
      setSavedTheme(selectedTheme)
      // Apply theme CSS custom properties immediately
      const t = THEMES[selectedTheme] || THEMES.fenix
      document.documentElement.style.setProperty('--color-brand', t.brand)
      document.documentElement.style.setProperty('--color-brand-light', t.light)
      document.documentElement.style.setProperty('--color-brand-dark', t.dark)
      setSaveMsg('✅ Tema guardado')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err) {
      setSaveMsg('❌ Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Handle custom background image upload
  const handleBgImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setSaveMsg('❌ La imagen debe ser menor a 10MB')
      return
    }
    try {
      setBgUploading(true)
      setSaveMsg('Subiendo imagen...')
      const formData = new FormData()
      formData.append('media', file)
      const data = await api.upload('/upload/media', formData)
      setSelectedBg(data.url)
      setSaveMsg('✅ Imagen subida. Guarda para aplicar.')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setSaveMsg('❌ Error al subir imagen')
    } finally {
      setBgUploading(false)
    }
  }

  // --- SUB PANELS ---

  // Color Theme Picker Panel
  if (activePanel === 'colorTheme') {
    return (
      <div className="profile-view">
        <div className="profile-view__panel-header">
          <button className="profile-view__back-btn" onClick={() => { setSelectedTheme(savedTheme); setActivePanel(null) }}>
            <ArrowLeft size={20} />
          </button>
          <span className="profile-view__panel-title">Tema de color</span>
          <button className="profile-view__save-btn" onClick={handleSaveTheme} disabled={saving || selectedTheme === savedTheme}>
            {saving ? '...' : <Check size={20} />}
          </button>
        </div>

        <div className="profile-view__theme-content">
          <label className="profile-view__field-label">Elige un color</label>
          <div className="profile-view__theme-grid">
            {THEME_LIST.map((theme) => (
              <button
                key={theme.id}
                className={`profile-view__theme-swatch ${selectedTheme === theme.id ? 'profile-view__theme-swatch--active' : ''}`}
                onClick={() => setSelectedTheme(theme.id)}
                title={theme.label}
              >
                <span
                  className="profile-view__theme-swatch-circle"
                  style={{ background: `linear-gradient(135deg, ${theme.light}, ${theme.brand}, ${theme.dark})` }}
                >
                  {selectedTheme === theme.id && (
                    <span className="profile-view__theme-swatch-check">
                      <Check size={16} />
                    </span>
                  )}
                </span>
                <span className="profile-view__theme-swatch-label">{theme.label}</span>
              </button>
            ))}
          </div>

          {/* Live preview bar */}
          <div className="profile-view__theme-preview">
            <label className="profile-view__field-label">Vista previa</label>
            <div
              className="profile-view__theme-preview-bar"
              style={{ background: `linear-gradient(135deg, ${(THEMES[selectedTheme] || THEMES.fenix).dark}, ${(THEMES[selectedTheme] || THEMES.fenix).brand}, ${(THEMES[selectedTheme] || THEMES.fenix).light})` }}
            >
              <span className="profile-view__theme-preview-text">Fenix</span>
            </div>
          </div>

          {saveMsg && (
            <div className="profile-view__save-msg">{saveMsg}</div>
          )}
        </div>
      </div>
    )
  }

  // Chat Background Picker Panel
  if (activePanel === 'chatBackground') {
    const previewBgCSS = getBackgroundCSS(selectedBg)
    const isCustomUrl = selectedBg && selectedBg.startsWith('http')

    return (
      <div className="profile-view">
        <div className="profile-view__panel-header">
          <button className="profile-view__back-btn" onClick={() => { setSelectedBg(savedBg); setActivePanel(null) }}>
            <ArrowLeft size={20} />
          </button>
          <span className="profile-view__panel-title">Fondo de chat</span>
          <button className="profile-view__save-btn" onClick={handleSaveBg} disabled={saving || selectedBg === savedBg}>
            {saving ? '...' : <Check size={20} />}
          </button>
        </div>

        <div className="profile-view__bg-content">
          {/* Preview */}
          <div className="profile-view__bg-preview-section">
            <label className="profile-view__field-label">Vista previa</label>
            <div
              className="profile-view__bg-preview"
              style={
                isCustomUrl
                  ? { backgroundImage: `url(${selectedBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : previewBgCSS
                    ? { background: previewBgCSS }
                    : {}
              }
            >
              {/* Fake chat bubbles for preview */}
              <div className="profile-view__bg-preview-bubble profile-view__bg-preview-bubble--other">
                Hola, ¿cómo estás? 👋
              </div>
              <div className="profile-view__bg-preview-bubble profile-view__bg-preview-bubble--own">
                ¡Todo bien! 🔥
              </div>
              <div className="profile-view__bg-preview-bubble profile-view__bg-preview-bubble--other">
                Qué bueno 😊
              </div>
            </div>
          </div>

          {/* Preset grid */}
          <div className="profile-view__bg-section">
            <label className="profile-view__field-label">Fondos predeterminados</label>
            <div className="profile-view__bg-grid">
              {CHAT_BG_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`profile-view__bg-swatch ${selectedBg === preset.id ? 'profile-view__bg-swatch--active' : ''}`}
                  style={{ background: preset.css }}
                  onClick={() => setSelectedBg(preset.id)}
                  title={preset.label}
                >
                  {selectedBg === preset.id && (
                    <span className="profile-view__bg-swatch-check">
                      <Check size={16} />
                    </span>
                  )}
                  {preset.id === 'default' && (
                    <span className="profile-view__bg-swatch-label">Sin fondo</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom upload */}
          <div className="profile-view__bg-section">
            <label className="profile-view__field-label">Imagen personalizada</label>
            <button
              className="profile-view__bg-upload-btn"
              onClick={() => bgFileInputRef.current?.click()}
              disabled={bgUploading}
            >
              <Upload size={18} />
              <span>{bgUploading ? 'Subiendo...' : 'Subir imagen'}</span>
            </button>
            <input
              ref={bgFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleBgImageUpload}
              style={{ display: 'none' }}
            />
            {isCustomUrl && (
              <div className="profile-view__bg-custom-preview">
                <img src={selectedBg} alt="Fondo personalizado" className="profile-view__bg-custom-thumb" />
                <button
                  className="profile-view__bg-custom-remove"
                  onClick={() => setSelectedBg('default')}
                >
                  <X size={14} />
                  <span>Quitar</span>
                </button>
              </div>
            )}
          </div>

          {saveMsg && (
            <div className="profile-view__save-msg">{saveMsg}</div>
          )}
        </div>
      </div>
    )
  }

  // Edit Profile Panel
  if (activePanel === 'editProfile') {
    return (
      <div className="profile-view">
        <div className="profile-view__panel-header">
          <button className="profile-view__back-btn" onClick={() => setActivePanel(null)}>
            <ArrowLeft size={20} />
          </button>
          <span className="profile-view__panel-title">Editar perfil</span>
          <button className="profile-view__save-btn" onClick={handleSaveProfile} disabled={saving}>
            {saving ? '...' : <Check size={20} />}
          </button>
        </div>

        <div className="profile-view__edit-content">
          {/* Avatar editable */}
          <div className="profile-view__avatar-edit" onClick={handleAvatarClick}>
            {user?.avatar_url || user?.avatarUrl ? (
              <img src={user.avatar_url || user.avatarUrl} alt="avatar" className="profile-view__avatar-img" />
            ) : (
              <div className="profile-view__avatar profile-view__avatar--large">
                {getInitials(user?.username)}
              </div>
            )}
            <div className="profile-view__avatar-overlay">
              <Camera size={24} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Campos editables */}
          <div className="profile-view__field">
            <label className="profile-view__field-label">Nombre de usuario</label>
            <input
              className="profile-view__field-input profile-view__field-input--disabled"
              value={user?.username || ''}
              disabled
            />
            <span className="profile-view__field-hint">No se puede cambiar</span>
          </div>

          <div className="profile-view__field">
            <label className="profile-view__field-label">Nombre para mostrar</label>
            <input
              className="profile-view__field-input"
              value={editForm.displayName}
              onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="Tu nombre visible"
              maxLength={50}
            />
          </div>

          <div className="profile-view__field">
            <label className="profile-view__field-label">Estado</label>
            <div className="profile-view__field-row">
              <input
                className="profile-view__field-input profile-view__field-input--emoji"
                value={editForm.statusEmoji}
                onChange={(e) => setEditForm(prev => ({ ...prev, statusEmoji: e.target.value }))}
                placeholder="🔥"
                maxLength={2}
              />
              <input
                className="profile-view__field-input"
                value={editForm.statusText}
                onChange={(e) => setEditForm(prev => ({ ...prev, statusText: e.target.value }))}
                placeholder="¿Qué estás haciendo?"
                maxLength={100}
              />
            </div>
          </div>

          <div className="profile-view__field">
            <label className="profile-view__field-label">Email</label>
            <input
              className="profile-view__field-input profile-view__field-input--disabled"
              value={user?.email || ''}
              disabled
            />
          </div>

          {saveMsg && (
            <div className="profile-view__save-msg">{saveMsg}</div>
          )}
        </div>
      </div>
    )
  }

  // Notifications Panel
  if (activePanel === 'notifications') {
    const notifAvailable = typeof window !== 'undefined' && 'Notification' in window
    const notifPermission = notifAvailable ? Notification.permission : 'default'
    const notifDenied = notifPermission === 'denied'
    const notifDefault = notifPermission === 'default'

    const browserNotifDesc = !notifAvailable
      ? '📱 Para activar, añade Fenix a tu pantalla de inicio'
      : notifDenied
        ? '⛔ Bloqueadas — toca para ver cómo activarlas'
        : notifDefault
          ? '🔔 Toca para activar notificaciones'
          : 'Mostrar notificaciones emergentes'

    return (
      <div className="profile-view">
        <div className="profile-view__panel-header">
          <button className="profile-view__back-btn" onClick={() => setActivePanel(null)}>
            <ArrowLeft size={20} />
          </button>
          <span className="profile-view__panel-title">Notificaciones</span>
          <div style={{ width: 32 }} />
        </div>

        <div className="profile-view__settings-list">
          <ToggleItem
            icon={Bell}
            label="Sonido de notificación"
            description="Reproducir sonido al recibir mensajes"
            value={notifSettings.sound}
            onChange={() => setNotifSettings(prev => ({ ...prev, sound: !prev.sound }))}
          />
          <ToggleItem
            icon={Globe}
            label="Notificaciones del navegador"
            description={browserNotifDesc}
            value={notifSettings.browserNotif}
            onChange={handleToggleBrowserNotif}
          />
          <ToggleItem
            icon={Info}
            label="Vista previa de mensajes"
            description="Mostrar contenido en las notificaciones"
            value={notifSettings.messagePreview}
            onChange={() => setNotifSettings(prev => ({ ...prev, messagePreview: !prev.messagePreview }))}
          />
        </div>

        {/* Sound selector */}
        <div className="profile-view__sound-section">
          <span className="profile-view__sound-title">Tono de notificación</span>
          <div className="profile-view__sound-list">
            {NOTIFICATION_SOUNDS.map(s => {
              const selected = (localStorage.getItem('fenix_notification_sound') || 'fenix') === s.id
              return (
                <button
                  key={s.id}
                  className={`profile-view__sound-item ${selected ? 'profile-view__sound-item--active' : ''}`}
                  onClick={() => { localStorage.setItem('fenix_notification_sound', s.id); previewSound(s.id); setNotifSettings(prev => ({ ...prev })) }}
                >
                  <span className="profile-view__sound-label">{s.label}</span>
                  <span className="profile-view__sound-desc">{s.description}</span>
                  {selected && <Check size={16} className="profile-view__sound-check" />}
                </button>
              )
            })}
          </div>
        </div>

        {!notifAvailable && (
          <div className="profile-view__notif-banner">
            <div className="profile-view__notif-banner-icon">📱</div>
            <div className="profile-view__notif-banner-text">
              <strong>¿Quieres notificaciones push?</strong>
              <p>En Safari iOS, abre el menú compartir (📤) y selecciona <strong>"Agregar a pantalla de inicio"</strong>. Luego abre la app desde ahí.</p>
            </div>
          </div>
        )}

        <div className="profile-view__notif-info">
          <p>🔊 <strong>El sonido</strong> siempre funciona cuando recibes un mensaje nuevo y no estás en esa conversación.</p>
          <p>🔔 <strong>Push notifications</strong> llegan aunque la app esté cerrada.</p>
        </div>

        {/* Notification help modal */}
        {showNotifHelpModal && (
          <NotifHelpModal onClose={() => setShowNotifHelpModal(false)} />
        )}
      </div>
    )
  }

  // Privacy Panel
  if (activePanel === 'privacy') {
    return (
      <div className="profile-view">
        <div className="profile-view__panel-header">
          <button className="profile-view__back-btn" onClick={() => setActivePanel(null)}>
            <ArrowLeft size={20} />
          </button>
          <span className="profile-view__panel-title">Privacidad</span>
          <div style={{ width: 32 }} />
        </div>

        <div className="profile-view__settings-list">
          <ToggleItem
            icon={User}
            label="Última conexión"
            description="Permitir que otros vean cuándo estuviste en línea"
            value={privacyLastSeen}
            onChange={(v) => { setPrivacyLastSeen(v); localStorage.setItem('fenix_privacy_lastseen', v) }}
          />
          <ToggleItem
            icon={Check}
            label="Confirmación de lectura"
            description="Mostrar cuando leíste un mensaje"
            value={privacyReadReceipts}
            onChange={(v) => { setPrivacyReadReceipts(v); localStorage.setItem('fenix_privacy_readreceipts', v) }}
          />
          <ToggleItem
            icon={Info}
            label="Info de perfil"
            description="Quién puede ver tu foto y estado"
            value={privacyProfileInfo}
            onChange={(v) => { setPrivacyProfileInfo(v); localStorage.setItem('fenix_privacy_profileinfo', v) }}
          />
        </div>
      </div>
    )
  }

  // Settings Panel
  if (activePanel === 'settings') {
    return (
      <div className="profile-view">
        <div className="profile-view__panel-header">
          <button className="profile-view__back-btn" onClick={() => setActivePanel(null)}>
            <ArrowLeft size={20} />
          </button>
          <span className="profile-view__panel-title">Configuración</span>
          <div style={{ width: 32 }} />
        </div>

        <div className="profile-view__settings-list">
          <button className="profile-view__settings-item" onClick={() => setActivePanel('colorTheme')}>
            <span className="profile-view__settings-icon" style={{ color: '#6C63FF' }}>
              <Palette size={20} />
            </span>
            <div className="profile-view__settings-text">
              <span className="profile-view__settings-label">Tema</span>
              <span className="profile-view__settings-desc">{THEMES[savedTheme]?.label || 'Fenix'}</span>
            </div>
            <ChevronRight size={18} className="profile-view__settings-chevron" />
          </button>

          <button className="profile-view__settings-item" disabled>
            <span className="profile-view__settings-icon" style={{ color: '#FFD93D' }}>
              <Globe size={20} />
            </span>
            <div className="profile-view__settings-text">
              <span className="profile-view__settings-label">Idioma</span>
              <span className="profile-view__settings-desc">Español</span>
            </div>
            <ChevronRight size={18} className="profile-view__settings-chevron" />
          </button>

          <div className="profile-view__divider" />

          {/* ── Privacy Section ── */}
          <div className="profile-view__section-label">🔒 Privacidad</div>

          <div className="profile-view__settings-item">
            <span className="profile-view__settings-icon">
              <Lock size={20} />
            </span>
            <div className="profile-view__settings-text" style={{ flex: 1 }}>
              <span className="profile-view__settings-label">Quién puede escribirme</span>
              <span className="profile-view__settings-desc">
                {user?.allowMessages === 'everyone' ? 'Todos' : user?.allowMessages === 'contacts' ? 'Solo contactos' : 'Nadie'}
              </span>
            </div>
            <select
              className="profile-view__privacy-select"
              value={user?.allowMessages || 'everyone'}
              onChange={async (e) => {
                try {
                  await api.patch('/users/me/privacy', { allowMessages: e.target.value })
                  setUser({ ...user, allowMessages: e.target.value })
                } catch (err) { alert('Error al actualizar') }
              }}
            >
              <option value="everyone">Todos</option>
              <option value="contacts">Solo contactos</option>
              <option value="nobody">Nadie</option>
            </select>
          </div>

          <div className="profile-view__settings-item">
            <span className="profile-view__settings-icon">
              <Globe size={20} />
            </span>
            <div className="profile-view__settings-text" style={{ flex: 1 }}>
              <span className="profile-view__settings-label">Visible en búsqueda</span>
              <span className="profile-view__settings-desc">
                {user?.isDiscoverable !== false ? 'Otros pueden encontrarte' : 'Oculto para todos'}
              </span>
            </div>
            <button
              className={`profile-view__privacy-switch ${user?.isDiscoverable !== false ? 'profile-view__privacy-switch--on' : ''}`}
              onClick={async () => {
                const newVal = user?.isDiscoverable === false ? true : false
                try {
                  await api.patch('/users/me/privacy', { isDiscoverable: newVal })
                  setUser({ ...user, isDiscoverable: newVal })
                } catch (err) { alert('Error al actualizar') }
              }}
            >
              <div className="profile-view__privacy-switch-thumb" />
            </button>
          </div>

          <div className="profile-view__divider" />

          <button className="profile-view__settings-item profile-view__settings-item--danger" onClick={handleLogout}>
            <span className="profile-view__settings-icon">
              <LogOut size={20} />
            </span>
            <div className="profile-view__settings-text">
              <span className="profile-view__settings-label">Cerrar sesión</span>
              <span className="profile-view__settings-desc">Salir de tu cuenta</span>
            </div>
          </button>

          <button className="profile-view__settings-item profile-view__settings-item--danger" onClick={() => {
            if (window.confirm('¿Estás seguro? Esta acción eliminará tu cuenta permanentemente.')) {
              api.delete('/users/me').then(() => {
                logout()
              }).catch(() => {
                alert('Error al eliminar la cuenta')
              })
            }
          }}>
            <span className="profile-view__settings-icon">
              <Trash2 size={20} />
            </span>
            <div className="profile-view__settings-text">
              <span className="profile-view__settings-label">Eliminar cuenta</span>
              <span className="profile-view__settings-desc">Esto no se puede deshacer</span>
            </div>
          </button>
        </div>

        <div className="profile-view__footer">
          <span className="profile-view__version">Fenix Messenger v1.0.0</span>
        </div>
      </div>
    )
  }

  // --- MAIN PROFILE VIEW ---
  return (
    <div className="profile-view">
      <div className="profile-view__user-section">
        <div className="profile-view__avatar-wrapper">
          {user?.avatar_url || user?.avatarUrl ? (
            <img
              src={user.avatar_url || user.avatarUrl}
              alt={user.username}
              className="profile-view__avatar-img-main"
            />
          ) : (
            <div className="profile-view__avatar">
              {getInitials(user?.username)}
            </div>
          )}
          <div className="profile-view__online-badge" />
        </div>
        <div className="profile-view__username">{user?.display_name || user?.displayName || user?.username || 'Usuario'}</div>
        <div className="profile-view__handle">@{user?.username}</div>
        {(user?.status_text || user?.statusText) && (
          <div className="profile-view__status-text">
            {user?.status_emoji || user?.statusEmoji} {user?.status_text || user?.statusText}
          </div>
        )}
      </div>

      <hr className="profile-view__divider" />

      <div className="profile-view__menu">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className="profile-view__menu-item"
              onClick={() => {
                if (item.id === 'editProfile') handleOpenEdit()
                else if (item.id === 'colorTheme') { setSelectedTheme(savedTheme); setActivePanel('colorTheme') }
                else setActivePanel(item.id)
              }}
              aria-label={item.label}
            >
              <span className="profile-view__menu-icon" style={{ color: item.color }}>
                <Icon size={20} />
              </span>
              <span className="profile-view__menu-label">{item.label}</span>
              <span className="profile-view__menu-chevron">
                <ChevronRight size={18} />
              </span>
            </button>
          )
        })}
      </div>

      <hr className="profile-view__divider" />

      <button className="profile-view__logout-btn" onClick={handleLogout}>
        <LogOut size={18} />
        <span>Cerrar sesión</span>
      </button>

      <div className="profile-view__footer">
        <span className="profile-view__version">Fenix Messenger v1.0.0</span>
      </div>
    </div>
  )
}

/** Toggle switch component for settings */
function ToggleItem({ icon: Icon, label, description, value, onChange }) {
  return (
    <button className="profile-view__toggle-item" onClick={onChange}>
      <span className="profile-view__toggle-icon">
        <Icon size={20} />
      </span>
      <div className="profile-view__toggle-text">
        <span className="profile-view__toggle-label">{label}</span>
        {description && <span className="profile-view__toggle-desc">{description}</span>}
      </div>
      <div className={`profile-view__toggle-switch ${value ? 'profile-view__toggle-switch--on' : ''}`}>
        <div className="profile-view__toggle-knob" />
      </div>
    </button>
  )
}

/** Modal with step-by-step instructions for enabling blocked notifications */
function NotifHelpModal({ onClose }) {
  const isAndroid = /android/i.test(navigator.userAgent)
  const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent)
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const isChrome = /chrome/i.test(navigator.userAgent) && !/edge|edg/i.test(navigator.userAgent)
  const isFirefox = /firefox/i.test(navigator.userAgent)

  const handleOpenSettings = () => {
    // Try to reload the page to re-trigger permission (fallback)
    window.open(window.location.origin, '_self')
  }

  return (
    <div className="notif-help-overlay" onClick={onClose}>
      <div className="notif-help-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="notif-help-modal__header">
          <div className="notif-help-modal__icon-wrapper">
            <AlertTriangle size={28} />
          </div>
          <h3 className="notif-help-modal__title">Notificaciones bloqueadas</h3>
          <p className="notif-help-modal__subtitle">
            Tu navegador bloqueó las notificaciones. Sigue estos pasos para activarlas:
          </p>
          <button className="notif-help-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Instructions */}
        <div className="notif-help-modal__body">
          {/* Chrome Desktop */}
          {(!isAndroid && !isIOS) && (
            <div className="notif-help-modal__instruction">
              <div className="notif-help-modal__instruction-icon">
                <Monitor size={20} />
              </div>
              <div className="notif-help-modal__instruction-content">
                <span className="notif-help-modal__instruction-browser">Chrome / Edge (Escritorio)</span>
                <ol className="notif-help-modal__steps">
                  <li>Haz click en el candado 🔒 en la barra de direcciones</li>
                  <li>Busca <strong>"Permisos"</strong> o <strong>"Configuración del sitio"</strong></li>
                  <li>En <strong>Notificaciones</strong> → selecciona <strong>Permitir</strong></li>
                  <li>Recarga la página</li>
                </ol>
              </div>
            </div>
          )}

          {/* Chrome Android */}
          {isAndroid && (
            <div className="notif-help-modal__instruction">
              <div className="notif-help-modal__instruction-icon">
                <Smartphone size={20} />
              </div>
              <div className="notif-help-modal__instruction-content">
                <span className="notif-help-modal__instruction-browser">Chrome (Android)</span>
                <ol className="notif-help-modal__steps">
                  <li>Toca el candado 🔒 junto a la URL</li>
                  <li>Toca <strong>"Permisos"</strong></li>
                  <li>En <strong>Notificaciones</strong> → activa el permiso</li>
                  <li>Recarga la página</li>
                </ol>
              </div>
            </div>
          )}

          {/* Safari */}
          {(isSafari || isIOS) && (
            <div className="notif-help-modal__instruction">
              <div className="notif-help-modal__instruction-icon">
                <Globe size={20} />
              </div>
              <div className="notif-help-modal__instruction-content">
                <span className="notif-help-modal__instruction-browser">Safari</span>
                <ol className="notif-help-modal__steps">
                  <li>Ve a <strong>Configuración</strong> del dispositivo</li>
                  <li>Busca <strong>Safari</strong> → <strong>Notificaciones</strong></li>
                  <li>Encuentra este sitio y activa las notificaciones</li>
                </ol>
              </div>
            </div>
          )}

          {/* Firefox */}
          {isFirefox && (
            <div className="notif-help-modal__instruction">
              <div className="notif-help-modal__instruction-icon">
                <Globe size={20} />
              </div>
              <div className="notif-help-modal__instruction-content">
                <span className="notif-help-modal__instruction-browser">Firefox</span>
                <ol className="notif-help-modal__steps">
                  <li>Haz click en el candado 🔒 en la barra de direcciones</li>
                  <li>Selecciona <strong>"Más información"</strong></li>
                  <li>Ve a <strong>Permisos</strong> → <strong>Notificaciones</strong> → <strong>Permitir</strong></li>
                  <li>Recarga la página</li>
                </ol>
              </div>
            </div>
          )}

          {/* Generic fallback — always show if none of the above matched */}
          {!isChrome && !isSafari && !isIOS && !isFirefox && !isAndroid && (
            <div className="notif-help-modal__instruction">
              <div className="notif-help-modal__instruction-icon">
                <Globe size={20} />
              </div>
              <div className="notif-help-modal__instruction-content">
                <span className="notif-help-modal__instruction-browser">Navegador</span>
                <ol className="notif-help-modal__steps">
                  <li>Busca el icono de candado 🔒 o ajustes en la barra de direcciones</li>
                  <li>Encuentra los permisos del sitio</li>
                  <li>Activa <strong>Notificaciones</strong></li>
                  <li>Recarga la página</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="notif-help-modal__actions">
          <button className="notif-help-modal__btn notif-help-modal__btn--primary" onClick={handleOpenSettings}>
            <ExternalLink size={16} />
            <span>Recargar y reintentar</span>
          </button>
          <button className="notif-help-modal__btn notif-help-modal__btn--secondary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

/** Resize image to max dimension */
function resizeImage(dataUrl, maxSize) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let w = img.width, h = img.height
      if (w > h) { h = (h / w) * maxSize; w = maxSize }
      else { w = (w / h) * maxSize; h = maxSize }
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.src = dataUrl
  })
}

export default ProfileView
