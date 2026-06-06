import { useState, useEffect } from 'react'
import { Users, MessageSquare, CheckCircle, BarChart3, Search, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import './AdminPanel.css'

function AdminPanel() {
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [usersData, statsData] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats'),
      ])
      setUsers(usersData.users || [])
      setStats(statsData)
    } catch (err) {
      console.error('Error loading admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : '?'

  if (loading) {
    return (
      <div className="admin">
        <div className="admin__loading">Cargando panel de admin...</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin__header">
        <button className="admin__back" onClick={() => navigate('/app')}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="admin__title">🔥 Panel de Administración</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="admin__stats">
          <div className="admin__stat-card">
            <div className="admin__stat-icon" style={{ background: 'rgba(0,245,255,0.1)', color: '#00F5FF' }}>
              <Users size={24} />
            </div>
            <div className="admin__stat-value">{stats.totalUsers}</div>
            <div className="admin__stat-label">Usuarios</div>
          </div>
          <div className="admin__stat-card">
            <div className="admin__stat-icon" style={{ background: 'rgba(0,255,136,0.1)', color: '#00FF88' }}>
              <CheckCircle size={24} />
            </div>
            <div className="admin__stat-value">{stats.verifiedUsers}</div>
            <div className="admin__stat-label">Verificados</div>
          </div>
          <div className="admin__stat-card">
            <div className="admin__stat-icon" style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF' }}>
              <MessageSquare size={24} />
            </div>
            <div className="admin__stat-value">{stats.totalConversations}</div>
            <div className="admin__stat-label">Conversaciones</div>
          </div>
          <div className="admin__stat-card">
            <div className="admin__stat-icon" style={{ background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}>
              <BarChart3 size={24} />
            </div>
            <div className="admin__stat-value">{stats.totalMessages}</div>
            <div className="admin__stat-label">Mensajes</div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="admin__search-bar">
        <Search size={16} />
        <input
          className="admin__search-input"
          placeholder="Buscar usuario..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="admin__search-count">{filtered.length} usuarios</span>
      </div>

      {/* User table */}
      <div className="admin__table-wrap">
        <table className="admin__table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Nombre</th>
              <th>Verificado</th>
              <th>Registro</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="admin__user-cell">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="admin__user-avatar" />
                    ) : (
                      <div className="admin__user-avatar-placeholder">
                        {getInitials(u.username)}
                      </div>
                    )}
                    <span className="admin__username">@{u.username}</span>
                  </div>
                </td>
                <td className="admin__email">{u.email}</td>
                <td>{u.display_name || '—'}</td>
                <td>
                  <span className={`admin__badge ${u.is_verified ? 'admin__badge--ok' : 'admin__badge--no'}`}>
                    {u.is_verified ? '✅ Sí' : '❌ No'}
                  </span>
                </td>
                <td className="admin__date">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminPanel
