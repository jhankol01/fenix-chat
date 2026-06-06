import { useState, useEffect, useCallback } from 'react'
import { Circle, MessageCircle, Search } from 'lucide-react'
import { getSocket } from '../../lib/socket'
import useAuthStore from '../../stores/authStore'
import useChatStore from '../../stores/chatStore'
import './OnlineUsers.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * OnlineUsers — Panel de presencia (solo visible para admin)
 * Muestra todos los usuarios registrados con su estado online/offline
 */
function OnlineUsers({ onSelectConversation }) {
  const [allUsers, setAllUsers] = useState([])
  const [onlineIds, setOnlineIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const user = useAuthStore(s => s.user)
  const accessToken = useAuthStore(s => s.accessToken)
  const { startDM, setActiveConversation } = useChatStore()

  // Load all users from admin endpoint
  useEffect(() => {
    if (!accessToken) return
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        const data = await res.json()
        setAllUsers(data.users || [])
      } catch (err) {
        console.error('Failed to load users:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [accessToken])

  // Listen for online/offline events
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onOnlineUsers = (ids) => {
      setOnlineIds(new Set(ids))
    }
    const onUserOnline = ({ userId }) => {
      setOnlineIds(prev => new Set([...prev, userId]))
    }
    const onUserOffline = ({ userId }) => {
      setOnlineIds(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }

    socket.on('online_users', onOnlineUsers)
    socket.on('user_online', onUserOnline)
    socket.on('user_offline', onUserOffline)

    return () => {
      socket.off('online_users', onOnlineUsers)
      socket.off('user_online', onUserOnline)
      socket.off('user_offline', onUserOffline)
    }
  }, [])

  // Start DM with a user
  const handleChatUser = useCallback(async (targetUser) => {
    try {
      const conv = await startDM(targetUser.id)
      if (conv) {
        setActiveConversation(conv)
        if (onSelectConversation) onSelectConversation(conv)
      }
    } catch (err) {
      console.error('Failed to start DM:', err)
    }
  }, [startDM, setActiveConversation, onSelectConversation])

  // Filter users
  const filteredUsers = allUsers
    .filter(u => u.id !== user?.id)
    .filter(u => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return u.username?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q)
    })

  // Sort: online first, then alphabetically
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aOnline = onlineIds.has(a.id) ? 0 : 1
    const bOnline = onlineIds.has(b.id) ? 0 : 1
    if (aOnline !== bOnline) return aOnline - bOnline
    return (a.username || '').localeCompare(b.username || '')
  })

  const onlineCount = filteredUsers.filter(u => onlineIds.has(u.id)).length

  return (
    <div className="online-users">
      <div className="online-users__header">
        <h2 className="online-users__title">Usuarios</h2>
        <span className="online-users__count">
          <Circle size={8} className="online-users__dot--on" />
          {onlineCount} en línea
        </span>
      </div>

      <div className="online-users__search">
        <Search size={16} className="online-users__search-icon" />
        <input
          type="text"
          className="online-users__search-input"
          placeholder="Buscar usuario..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="online-users__list">
        {loading ? (
          <div className="online-users__loading">Cargando usuarios...</div>
        ) : sortedUsers.length === 0 ? (
          <div className="online-users__empty">No se encontraron usuarios</div>
        ) : (
          sortedUsers.map(u => {
            const isOnline = onlineIds.has(u.id)
            return (
              <div
                key={u.id}
                className={`online-users__item ${isOnline ? 'online-users__item--online' : ''}`}
                onClick={() => handleChatUser(u)}
              >
                <div className="online-users__avatar">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.username} className="online-users__avatar-img" />
                  ) : (
                    <div className="online-users__avatar-fallback">
                      {(u.username || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className={`online-users__status-dot ${isOnline ? 'online-users__status-dot--on' : ''}`} />
                </div>
                <div className="online-users__info">
                  <span className="online-users__name">{u.username}</span>
                  <span className="online-users__status-text">
                    {isOnline ? 'En línea' : 'Desconectado'}
                  </span>
                </div>
                <MessageCircle size={18} className="online-users__chat-icon" />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default OnlineUsers
