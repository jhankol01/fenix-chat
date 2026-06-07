import { useState, useEffect, useRef } from 'react'
import { Search, UserPlus, Trash2, MessageCircle, Loader2 } from 'lucide-react'
import api from '../../lib/api'
import useChatStore from '../../stores/chatStore'
import './ContactsView.css'

/**
 * ContactsView — Lista de contactos guardados + agregar nuevos
 */
function ContactsView({ onSelectConversation }) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingId, setAddingId] = useState(null)
  const searchTimer = useRef(null)

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

  useEffect(() => { loadContacts() }, [])

  // Buscar usuarios para agregar
  const handleSearch = (value) => {
    setQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.length < 2) { setSearchResults([]); return }

    searchTimer.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await useChatStore.getState().searchUsers(value)
        // Filtrar los que ya son contactos
        const contactIds = contacts.map(c => c.contact_id)
        setSearchResults(results.filter(u => !contactIds.includes(u.id)))
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }

  // Agregar contacto
  const handleAddContact = async (userId) => {
    setAddingId(userId)
    try {
      await api.post('/contacts', { contactId: userId })
      await loadContacts()
      // Quitar de resultados
      setSearchResults(prev => prev.filter(u => u.id !== userId))
    } catch (err) {
      console.error('Add contact error:', err)
    } finally {
      setAddingId(null)
    }
  }

  // Eliminar contacto
  const handleRemoveContact = async (contactId) => {
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
        <button
          className={`contacts-view__add-btn ${showAdd ? 'contacts-view__add-btn--active' : ''}`}
          onClick={() => { setShowAdd(!showAdd); setQuery(''); setSearchResults([]) }}
        >
          <UserPlus size={20} />
        </button>
      </div>

      {/* Panel de agregar contacto */}
      {showAdd && (
        <div className="contacts-view__add-panel">
          <div className="contacts-view__search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar usuario..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="contacts-view__search-results">
            {isSearching && (
              <div className="contacts-view__loading">
                <Loader2 size={18} className="spin" /> Buscando...
              </div>
            )}
            {!isSearching && query.length >= 2 && searchResults.length === 0 && (
              <div className="contacts-view__empty-search">No se encontraron usuarios</div>
            )}
            {searchResults.map(user => (
              <div key={user.id} className="contacts-view__search-item">
                <div className="contacts-view__avatar">
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt="" />
                    : <span>{getInitials(user.username)}</span>
                  }
                </div>
                <div className="contacts-view__info">
                  <span className="contacts-view__name">{user.username}</span>
                  {user.display_name && <span className="contacts-view__display">{user.display_name}</span>}
                </div>
                <button
                  className="contacts-view__action-btn contacts-view__action-btn--add"
                  onClick={() => handleAddContact(user.id)}
                  disabled={addingId === user.id}
                >
                  {addingId === user.id ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de contactos */}
      {loading ? (
        <div className="contacts-view__loading"><Loader2 size={24} className="spin" /></div>
      ) : contacts.length === 0 ? (
        <div className="contacts-view__empty">
          <div className="contacts-view__empty-icon">👥</div>
          <p>No tienes contactos aún</p>
          <button className="contacts-view__empty-btn" onClick={() => setShowAdd(true)}>
            <UserPlus size={16} /> Agregar contacto
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
    </div>
  )
}

export default ContactsView
