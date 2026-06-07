import { useState, useRef } from 'react'
import {
  User, Bell, Lock, Settings, ChevronRight, Camera, LogOut,
  ArrowLeft, Check, X, Moon, Globe, Trash2, Info, Palette
} from 'lucide-react'
import useAuthStore from '../../stores/authStore'
import api from '../../lib/api'
import './ProfileView.css'

/**
 * ProfileView — Pantalla de perfil del usuario (tab "Yo")
 * Muestra avatar, nombre, estado, y opciones de menú con subpantallas
 */
function ProfileView() {
  const [activePanel, setActivePanel] = useState(null) // null | 'editProfile' | 'notifications' | 'privacy' | 'settings'
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const fileInputRef = useRef(null)

  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)
  const setUser = useAuthStore(state => state.setUser)

  // Edit profile state
  const [editForm, setEditForm] = useState({
    displayName: '',
    statusText: '',
    statusEmoji: '',
  })

  // Notification settings (local)
  const [notifSettings, setNotifSettings] = useState({
    sound: true,
    browserNotif: typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted',
    messagePreview: true,
  })

  const menuItems = [
    { id: 'editProfile', icon: User, label: 'Editar perfil', color: '#00F5FF' },
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
    if (!notifSettings.browserNotif) {
      const result = await Notification.requestPermission()
      setNotifSettings(prev => ({ ...prev, browserNotif: result === 'granted' }))
    } else {
      setNotifSettings(prev => ({ ...prev, browserNotif: false }))
    }
  }

  // --- SUB PANELS ---

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
    const notifDenied = notifAvailable && Notification.permission === 'denied'

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
            description={
              !notifAvailable
                ? '📱 Para activar, añade Fénix a tu pantalla de inicio'
                : notifDenied
                  ? '⛔ Bloqueadas. Ve a ajustes del navegador para permitir'
                  : 'Mostrar notificaciones emergentes'
            }
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
          <p>💬 <strong>El título de la pestaña</strong> también cambia para avisarte.</p>
        </div>
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
            value={true}
            onChange={() => {}}
          />
          <ToggleItem
            icon={Check}
            label="Confirmación de lectura"
            description="Mostrar cuando leíste un mensaje"
            value={true}
            onChange={() => {}}
          />
          <ToggleItem
            icon={Info}
            label="Info de perfil"
            description="Quién puede ver tu foto y estado"
            value={true}
            onChange={() => {}}
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
          <button className="profile-view__settings-item" disabled>
            <span className="profile-view__settings-icon" style={{ color: '#6C63FF' }}>
              <Palette size={20} />
            </span>
            <div className="profile-view__settings-text">
              <span className="profile-view__settings-label">Tema</span>
              <span className="profile-view__settings-desc">Oscuro (predeterminado)</span>
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

          <button className="profile-view__settings-item profile-view__settings-item--danger" onClick={handleLogout}>
            <span className="profile-view__settings-icon">
              <LogOut size={20} />
            </span>
            <div className="profile-view__settings-text">
              <span className="profile-view__settings-label">Cerrar sesión</span>
              <span className="profile-view__settings-desc">Salir de tu cuenta</span>
            </div>
          </button>

          <button className="profile-view__settings-item profile-view__settings-item--danger" disabled>
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
          <span className="profile-view__version">Fénix Chat v1.0.0</span>
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
              onClick={() => item.id === 'editProfile' ? handleOpenEdit() : setActivePanel(item.id)}
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
        <span className="profile-view__version">Fénix Chat v1.0.0</span>
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
