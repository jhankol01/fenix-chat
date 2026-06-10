import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, MessageSquare, CheckCircle, BarChart3, Search, ArrowLeft,
  Flame, CalendarDays, Camera, Coins, TrendingUp, Clock, RefreshCw,
  Crown, Medal, Award, UserPlus, ShieldCheck, Mail, Hash
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import './AdminPanel.css'

const REFRESH_INTERVAL = 30000

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function formatNumber(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString('es')
}

function relativeTime(dateStr) {
  if (!dateStr) return '—'
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'hace un momento'
  if (diffMins < 60) return `hace ${diffMins} min`
  if (diffHours < 24) return `hace ${diffHours}h`
  if (diffDays < 7) return `hace ${diffDays}d`
  return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getInitials(name) {
  return name ? name.slice(0, 2).toUpperCase() : '?'
}

// ── Skeleton components ──────────────────────────────

function StatSkeleton() {
  return (
    <div className="admin__stat-card admin__skeleton-card">
      <div className="admin__skeleton admin__skeleton--icon" />
      <div className="admin__skeleton admin__skeleton--number" />
      <div className="admin__skeleton admin__skeleton--label" />
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="admin__chart-card admin__skeleton-card">
      <div className="admin__skeleton admin__skeleton--title" />
      <div className="admin__chart-bars">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="admin__chart-bar-col">
            <div className="admin__skeleton admin__skeleton--bar" style={{ height: `${30 + Math.random() * 50}%` }} />
            <div className="admin__skeleton admin__skeleton--bar-label" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="admin__table-wrap admin__skeleton-card">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="admin__skeleton-row">
          <div className="admin__skeleton admin__skeleton--avatar" />
          <div className="admin__skeleton admin__skeleton--text" />
          <div className="admin__skeleton admin__skeleton--text-short" />
        </div>
      ))}
    </div>
  )
}

// ── Bar Chart (CSS only) ────────────────────────────

function BarChart({ data, color = '#7C3AED', label }) {
  if (!data || data.length === 0) {
    return (
      <div className="admin__chart-card">
        <h3 className="admin__chart-title">{label}</h3>
        <div className="admin__chart-empty">Sin datos disponibles</div>
      </div>
    )
  }

  const maxVal = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="admin__chart-card">
      <h3 className="admin__chart-title">{label}</h3>
      <div className="admin__chart-bars">
        {data.slice(-7).map((item, i) => {
          const pct = (item.count / maxVal) * 100
          const dayDate = new Date(item.date)
          const dayName = DAY_NAMES[dayDate.getDay()]

          return (
            <div key={i} className="admin__chart-bar-col">
              <span className="admin__chart-bar-value">{item.count}</span>
              <div className="admin__chart-bar-track">
                <div
                  className="admin__chart-bar-fill"
                  style={{
                    height: `${Math.max(pct, 4)}%`,
                    background: `linear-gradient(180deg, ${color}, ${color}88)`,
                    animationDelay: `${i * 80}ms`
                  }}
                />
              </div>
              <span className="admin__chart-bar-label">{dayName}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Avatar component ────────────────────────────────

function Avatar({ url, name, size = 36 }) {
  if (url) {
    return <img src={url} alt="" className="admin__avatar" style={{ width: size, height: size }} />
  }
  return (
    <div className="admin__avatar-placeholder" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {getInitials(name)}
    </div>
  )
}

// ── Main Component ──────────────────────────────────

function AdminPanel() {
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()
  const refreshTimerRef = useRef(null)

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      setError(null)

      const [usersData, statsData] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats'),
      ])

      setUsers(usersData.users || [])
      setStats(statsData)
    } catch (err) {
      console.error('Error loading admin data:', err)
      if (!isRefresh) setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    // Auto-refresh every 30s
    refreshTimerRef.current = setInterval(() => {
      loadData(true)
    }, REFRESH_INTERVAL)

    // Clock tick
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      clearInterval(refreshTimerRef.current)
      clearInterval(clockInterval)
    }
  }, [loadData])

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  const timeStr = currentTime.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = currentTime.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })

  // ── Stats config ──────────────────────────────────

  const statsConfig = stats ? [
    { icon: Users,        label: 'Total Usuarios',     value: stats.totalUsers,           delta: `+${stats.newUsersToday || 0} hoy`, color: '#00F5FF' },
    { icon: CheckCircle,  label: 'Verificados',        value: stats.verifiedUsers,        delta: null,                               color: '#10b981' },
    { icon: MessageSquare,label: 'Mensajes Total',     value: stats.totalMessages,        delta: `+${stats.messagesToday || 0} hoy`, color: '#A855F7' },
    { icon: BarChart3,    label: 'Conversaciones',     value: stats.totalConversations,   delta: null,                               color: '#f59e0b' },
    { icon: Flame,        label: 'Activos Hoy',        value: stats.activeUsersToday,     delta: null,                               color: '#ef4444' },
    { icon: CalendarDays, label: 'Activos Semana',     value: stats.activeUsersWeek,      delta: null,                               color: '#3b82f6' },
    { icon: Camera,       label: 'Stories Activas',    value: stats.activeStories,        delta: `${stats.totalStoryViews || 0} views`, color: '#ec4899' },
    { icon: Coins,        label: 'Coins Circulando',   value: stats.totalCoinsCirculating,delta: null,                               color: '#f59e0b' },
  ] : []

  // ── Render ────────────────────────────────────────

  if (error && !stats) {
    return (
      <div className="admin">
        <div className="admin__error">
          <Flame size={48} />
          <h2>Error al cargar el panel</h2>
          <p>{error}</p>
          <button className="admin__retry-btn" onClick={() => { setLoading(true); loadData() }}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      {/* ── Header ───────────────────────────────── */}
      <header className="admin__header">
        <div className="admin__header-left">
          <button className="admin__back" onClick={() => navigate('/app')} title="Volver">
            <ArrowLeft size={20} />
          </button>
          <div className="admin__header-text">
            <h1 className="admin__title">🔥 Fenix Command Center</h1>
            <span className="admin__subtitle">{dateStr}</span>
          </div>
        </div>
        <div className="admin__header-right">
          <button
            className={`admin__refresh-btn ${refreshing ? 'admin__refresh-btn--spinning' : ''}`}
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refrescar datos"
          >
            <RefreshCw size={16} />
          </button>
          <div className="admin__clock">
            <Clock size={14} />
            <span>{timeStr}</span>
          </div>
        </div>
      </header>

      {/* ── Stats Grid ───────────────────────────── */}
      <section className="admin__stats">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <StatSkeleton key={i} />)
          : statsConfig.map((s, i) => {
              const Icon = s.icon
              return (
                <div className="admin__stat-card" key={i} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="admin__stat-icon" style={{ background: `${s.color}15`, color: s.color }}>
                    <Icon size={22} />
                  </div>
                  <div className="admin__stat-value">{formatNumber(s.value)}</div>
                  <div className="admin__stat-label">{s.label}</div>
                  {s.delta && (
                    <div className="admin__stat-delta">
                      <TrendingUp size={12} />
                      {s.delta}
                    </div>
                  )}
                </div>
              )
            })
        }
      </section>

      {/* ── Charts ───────────────────────────────── */}
      <section className="admin__charts">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <BarChart
              data={stats?.messagesByDay}
              color="#A855F7"
              label="📊 Mensajes por Día"
            />
            <BarChart
              data={stats?.usersByDay}
              color="#00F5FF"
              label="👥 Nuevos Usuarios por Día"
            />
          </>
        )}
      </section>

      {/* ── Top Users ────────────────────────────── */}
      <section className="admin__section">
        <h2 className="admin__section-title">
          <Crown size={20} /> Top Usuarios Activos
        </h2>
        {loading ? (
          <TableSkeleton />
        ) : (
          <div className="admin__top-users">
            {(stats?.topUsers || []).slice(0, 5).map((user, i) => {
              const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default'
              const RankIcon = i === 0 ? Crown : i === 1 ? Medal : i === 2 ? Award : Hash

              return (
                <div className={`admin__top-card admin__top-card--${rankClass}`} key={i} style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="admin__top-rank">
                    <RankIcon size={i < 3 ? 20 : 16} />
                    <span>#{i + 1}</span>
                  </div>
                  <Avatar url={user.avatar_url} name={user.username || user.display_name} size={44} />
                  <div className="admin__top-info">
                    <span className="admin__top-name">{user.display_name || user.username}</span>
                    <span className="admin__top-username">@{user.username}</span>
                  </div>
                  <div className="admin__top-count">
                    <MessageSquare size={14} />
                    <span>{formatNumber(user.message_count)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Recent Signups ───────────────────────── */}
      <section className="admin__section">
        <h2 className="admin__section-title">
          <UserPlus size={20} /> Registros Recientes
        </h2>
        {loading ? (
          <TableSkeleton />
        ) : (
          <div className="admin__recent-list">
            {(stats?.recentUsers || []).slice(0, 10).map((user, i) => (
              <div className="admin__recent-item" key={i} style={{ animationDelay: `${i * 50}ms` }}>
                <Avatar url={user.avatar_url} name={user.username || user.display_name} size={36} />
                <div className="admin__recent-info">
                  <div className="admin__recent-name-row">
                    <span className="admin__recent-name">{user.display_name || user.username}</span>
                    {user.is_verified && (
                      <ShieldCheck size={14} className="admin__verified-icon" />
                    )}
                  </div>
                  <span className="admin__recent-username">@{user.username}</span>
                </div>
                <span className="admin__recent-time">{relativeTime(user.created_at)}</span>
              </div>
            ))}
            {(!stats?.recentUsers || stats.recentUsers.length === 0) && (
              <div className="admin__empty-state">No hay registros recientes</div>
            )}
          </div>
        )}
      </section>

      {/* ── User Management ──────────────────────── */}
      <section className="admin__section">
        <h2 className="admin__section-title">
          <Users size={20} /> Gestión de Usuarios
        </h2>

        <div className="admin__search-bar">
          <Search size={16} />
          <input
            className="admin__search-input"
            placeholder="Buscar por nombre, email o username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="admin__search-count">{filtered.length} usuarios</span>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : (
          <div className="admin__table-wrap">
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Password Hash</th>
                  <th>Nombre</th>
                  <th>Verificado</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin__table-empty">
                      No se encontraron usuarios
                    </td>
                  </tr>
                ) : (
                  filtered.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="admin__user-cell">
                          <Avatar url={u.avatar_url} name={u.username} size={32} />
                          <span className="admin__username">@{u.username}</span>
                        </div>
                      </td>
                      <td className="admin__email">
                        <Mail size={13} className="admin__email-icon" />
                        {u.email}
                      </td>
                      <td className="admin__hash" title={u.password_hash || ''}>
                        <code>{u.password_hash ? u.password_hash.slice(0, 20) + '...' : '—'}</code>
                      </td>
                      <td>{u.display_name || '—'}</td>
                      <td>
                        <span className={`admin__badge ${u.is_verified ? 'admin__badge--ok' : 'admin__badge--no'}`}>
                          {u.is_verified ? (
                            <><CheckCircle size={12} /> Verificado</>
                          ) : (
                            'Pendiente'
                          )}
                        </span>
                      </td>
                      <td className="admin__date">{formatDate(u.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default AdminPanel
