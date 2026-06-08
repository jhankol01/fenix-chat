import { useState, useEffect, useRef } from 'react'
import { Search, UserPlus, Trash2, MessageCircle, Loader2, Check, X, Clock, Send, Bell, Users, Copy } from 'lucide-react'
import api from '../../lib/api'
import useChatStore from '../../stores/chatStore'
import './ContactsView.css'

/**
 * ContactsView — Contactos + Solicitudes de amistad con sistema @username
 */
function ContactsView({ onSelectConversation }) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('contacts') // contacts | requests | add
  const [query, setQuery] = useState('')
  const [sendStatus, setSendStatus] = useState(null) // null | 'sending' | 'sent' | 'error'
  const [sendMessage, setSendMessage] = useState('')
  const [pendingRequests, setPendingRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [processingId, setProcessingId] = useState(null)

  // Cargar contactos
  const loadContacts = async () => {
    try {
      const data = await api.get('/contacts')
      setContacts(data.contacts || [])
    } catch (err) {
      console.error('Error loading contacts:', err)
    } finally {
      setLoading(false)
    }
  }

  // Cargar solicitudes pendientes
  const loadRequests = async () => {
    try {
      const [pending, sent] = await Promise.all([
        api.get('/friend-requests/pending'),
        api.get('/friend-requests/sent')
      ])
      setPendingRequests(pending.requests || [])
      setSentRequests(sent.requests || [])
    } catch (err) {
      console.error('Error loading requests:', err)
    }
  }

  useEffect(() => {
    loadContacts()
    loadRequests()
    // Poll for new requests every 30s
    const interval = setInterval(loadRequests, 30000)
    return () => clearInterval(interval)
  }, [])

  // Enviar solicitud por @username
  const handleSendRequest = async () => {
    let username = query.trim()
    if (username.startsWith('@')) username = username.slice(1)
    if (!username || username.length < 2) return

    setSendStatus('sending')
    setSendMessage('')
    try {
      const data = await api.post('/friend-requests', { username })
      if (data.autoAccepted) {
        setSendMessage('¡Ya se agregaron mutuamente! 🎉')
        setSendStatus('sent')
        loadContacts()
        loadRequests()
      } else {
        setSendMessage(`Solicitud enviada a @${username} ✓`)
        setSendStatus('sent')
        loadRequests()
      }
      setQuery('')
    } catch (err) {
      setSendMessage(err.message || 'Error al enviar solicitud')
      setSendStatus('error')
    }
    setTimeout(() => { setSendStatus(null); setSendMessage('') }, 4000)
  }

  // Aceptar solicitud
  const handleAccept = async (requestId) => {
    setProcessingId(requestId)
    try {
      await api.post(`/friend-requests/${requestId}/accept`)
      loadContacts()
      loadRequests()
    } catch (err) {
      console.error('Accept error:', err)
    } finally {
      setProcessingId(null)
    }
  }

  // Rechazar solicitud
  const handleReject = async (requestId) => {
    setProcessingId(requestId)
    try {
      await api.post(`/friend-requests/${requestId}/reject`)
      loadRequests()
    } catch (err) {
      console.error('Reject error:', err)
    } finally {
      setProcessingId(null)
    }
  }

  // Eliminar contacto
  const handleRemoveContact = async (contactId) => {
    if (!confirm('¿Eliminar este contacto?')) return
    try {
      await api.delete(`/contacts/${contactId}`)
      setContacts(prev => prev.filter(c => c.contact_id !== contactId))
    } catch (err) {
      console.error('Remove contact error:', err)
    }
  }

  // Abrir chat con contacto
  const handleOpenChat = async (contactUserId) => {
    try {
      const conversation = await useChatStore.getState().startDM(contactUserId)
      if (onSelectConversation) onSelectConversation(conversation)
    } catch (err) {
      console.error('Open chat error:', err)
    }
  }

  const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : '?'

  return (
    <div className="contacts-view">
      <div className="contacts-view__header">
        <h2 className="contacts-view__title">Contactos</h2>
        <span className="contacts-view__count">{contacts.length}</span>
        {pendingRequests.length > 0 && (
          <span className="contacts-view__badge" onClick={() => setTab('requests')}>
            {pendingRequests.length}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="contacts-view__tabs">
        <button
          className={`contacts-view__tab ${tab === 'contacts' ? 'contacts-view__tab--active' : ''}`}
          onClick={() => setTab('contacts')}
        >
          <Users size={14} /> Contactos
        </button>
        <button
          className={`contacts-view__tab ${tab === 'requests' ? 'contacts-view__tab--active' : ''}`}
          onClick={() => setTab('requests')}
        >
          <Bell size={14} /> Solicitudes
          {pendingRequests.length > 0 && <span className="contacts-view__tab-badge">{pendingRequests.length}</span>}
        </button>
        <button
          className={`contacts-view__tab ${tab === 'add' ? 'contacts-view__tab--active' : ''}`}
          onClick={() => setTab('add')}
        >
          <UserPlus size={14} /> Agregar
        </button>
      </div>

      {/* ── Tab: Add friend by @username ── */}
      {tab === 'add' && (
        <div className="contacts-view__add-section">
          <div className="contacts-view__add-info">
            <p>Agrega amigos con su nombre de usuario</p>
            <span>Ejemplo: @jazly221729</span>
          </div>
          <div className="contacts-view__add-input-row">
            <div className="contacts-view__add-input-wrap">
              <span className="contacts-view__at-symbol">@</span>
              <input
                type="text"
                placeholder="nombre_de_usuario"
                value={query}
                onChange={(e) => setQuery(e.target.value.replace(/^@/, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                autoFocus
              />
            </div>
            <button
              className="contacts-view__send-btn"
              onClick={handleSendRequest}
              disabled={!query.trim() || query.trim().length < 2 || sendStatus === 'sending'}
            >
              {sendStatus === 'sending' ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              Enviar
            </button>
          </div>
          {sendMessage && (
            <div className={`contacts-view__send-msg ${sendStatus === 'error' ? 'contacts-view__send-msg--error' : sendStatus === 'sent' ? 'contacts-view__send-msg--success' : ''}`}>
              {sendMessage}
            </div>
          )}

          {/* Sent requests */}
          {sentRequests.length > 0 && (
            <div className="contacts-view__sub-section">
              <div className="contacts-view__sub-title">Solicitudes enviadas</div>
              {sentRequests.map(req => (
                <div key={req.id} className="contacts-view__request-item">
                  <div className="contacts-view__avatar">
                    {req.receiver_avatar ? <img src={req.receiver_avatar} alt="" /> : <span>{getInitials(req.receiver_username)}</span>}
                  </div>
                  <div className="contacts-view__info">
                    <span className="contacts-view__name">@{req.receiver_username}</span>
                    <span className="contacts-view__request-status"><Clock size={12} /> Pendiente</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Pending requests ── */}
      {tab === 'requests' && (
        <div className="contacts-view__requests-section">
          {pendingRequests.length === 0 ? (
            <div className="contacts-view__empty">
              <div className="contacts-view__empty-icon">📬</div>
              <p>No tienes solicitudes pendientes</p>
            </div>
          ) : (
            pendingRequests.map(req => (
              <div key={req.id} className="contacts-view__request-item contacts-view__request-item--incoming">
                <div className="contacts-view__avatar">
                  {req.sender_avatar ? <img src={req.sender_avatar} alt="" /> : <span>{getInitials(req.sender_username)}</span>}
                </div>
                <div className="contacts-view__info">
                  <span className="contacts-view__name">{req.sender_display_name || req.sender_username}</span>
                  <span className="contacts-view__display">@{req.sender_username}</span>
                  <span className="contacts-view__request-time">
                    {new Date(req.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="contacts-view__request-actions">
                  <button
                    className="contacts-view__action-btn contacts-view__action-btn--accept"
                    onClick={() => handleAccept(req.id)}
                    disabled={processingId === req.id}
                  >
                    {processingId === req.id ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                  </button>
                  <button
                    className="contacts-view__action-btn contacts-view__action-btn--reject"
                    onClick={() => handleReject(req.id)}
                    disabled={processingId === req.id}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Tab: Contact list ── */}
      {tab === 'contacts' && (
        <>
          {loading ? (
            <div className="contacts-view__loading"><Loader2 size={24} className="spin" /></div>
          ) : contacts.length === 0 ? (
            <div className="contacts-view__empty">
              <div className="contacts-view__empty-icon">👥</div>
              <p>No tienes contactos aún</p>
              <button className="contacts-view__empty-btn" onClick={() => setTab('add')}>
                <UserPlus size={16} /> Agregar amigo
              </button>
            </div>
          ) : (
            <div className="contacts-view__list">
              {contacts.map(contact => (
                <div key={contact.id} className="contacts-view__item">
                  <div className="contacts-view__avatar" onClick={() => handleOpenChat(contact.contact_id)}>
                    {contact.avatar_url
                      ? <img src={contact.avatar_url} alt="" />
                      : <span>{getInitials(contact.username)}</span>
                    }
                  </div>
                  <div className="contacts-view__info" onClick={() => handleOpenChat(contact.contact_id)}>
                    <span className="contacts-view__name">{contact.nickname || contact.username}</span>
                    {contact.display_name && <span className="contacts-view__display">{contact.display_name}</span>}
                    {contact.status_text && (
                      <span className="contacts-view__status">
                        {contact.status_emoji} {contact.status_text}
                      </span>
                    )}
                  </div>
                  <div className="contacts-view__actions">
                    <button className="contacts-view__action-btn" onClick={() => handleOpenChat(contact.contact_id)}>
                      <MessageCircle size={16} />
                    </button>
                    <button className="contacts-view__action-btn contacts-view__action-btn--delete" onClick={() => handleRemoveContact(contact.contact_id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ContactsView
