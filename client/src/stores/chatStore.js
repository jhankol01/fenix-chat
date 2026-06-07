import { create } from 'zustand'
import api from '../lib/api'
import { getSocket } from '../lib/socket'

/**
 * Chat Store — Gestiona conversaciones, mensajes, typing, y búsqueda de usuarios
 * Usa Zustand siguiendo el mismo patrón del authStore
 */
const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  typingUsers: {},
  unreadCounts: {},  // { conversationId: count }
  isLoadingConversations: false,
  isLoadingMessages: false,
  hasMoreMessages: true,

  // Cargar conversaciones desde la API
  loadConversations: async () => {
    set({ isLoadingConversations: true })
    try {
      const data = await api.get('/conversations')
      set({ conversations: data.conversations || [], isLoadingConversations: false })
    } catch (err) {
      console.error('Failed to load conversations:', err)
      set({ isLoadingConversations: false })
    }
  },

  // Establecer la conversación activa y cargar sus mensajes
  setActiveConversation: async (conversation) => {
    // Clear unread count for this conversation
    if (conversation) {
      set(state => {
        const unreadCounts = { ...state.unreadCounts }
        delete unreadCounts[conversation.id]
        return { activeConversation: conversation, messages: [], hasMoreMessages: true, unreadCounts }
      })
    } else {
      set({ activeConversation: conversation, messages: [], hasMoreMessages: true })
    }
    const socket = getSocket()
    if (socket && conversation) {
      socket.emit('join_conversation', conversation.id)
    }
    if (conversation) {
      await get().loadMessages(conversation.id)
    }
  },

  // Cargar mensajes de una conversación (con paginación)
  loadMessages: async (conversationId, before = null) => {
    set({ isLoadingMessages: true })
    try {
      const params = before ? `?before=${before}&limit=50` : '?limit=50'
      const data = await api.get(`/conversations/${conversationId}/messages${params}`)
      const msgs = data.messages || []
      if (before) {
        // Prepend mensajes más antiguos
        set(state => ({
          messages: [...msgs, ...state.messages],
          isLoadingMessages: false,
          hasMoreMessages: msgs.length === 50
        }))
      } else {
        set({
          messages: msgs,
          isLoadingMessages: false,
          hasMoreMessages: msgs.length === 50
        })
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
      set({ isLoadingMessages: false })
    }
  },

  // Enviar un mensaje vía socket
  sendMessage: (content, type = 'text') => {
    const socket = getSocket()
    const { activeConversation } = get()
    if (socket && activeConversation && content) {
      socket.emit('send_message', {
        conversationId: activeConversation.id,
        content: type === 'text' ? content.trim() : content,
        type
      })
    }
  },

  // Agregar mensaje entrante (recibido por socket)
  addMessage: (message) => {
    set(state => {
      const { activeConversation } = state

      // Agregar a mensajes solo si es la conversación activa
      const newMessages = activeConversation?.id === message.conversation_id
        ? [...state.messages, message]
        : state.messages
      
      // Actualizar el último mensaje de la conversación en la lista
      const conversations = (state.conversations || []).map(c => 
        c.id === message.conversation_id
          ? { ...c, last_message: message.content, last_message_at: message.created_at, last_sender: message.sender_username }
          : c
      ).sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0))

      // Increment unread count if NOT the active conversation
      const unreadCounts = { ...state.unreadCounts }
      if (activeConversation?.id !== message.conversation_id) {
        unreadCounts[message.conversation_id] = (unreadCounts[message.conversation_id] || 0) + 1
      }

      return { messages: newMessages, conversations, unreadCounts }
    })
  },

  // Indicadores de escritura — enviar al servidor
  setTyping: (conversationId) => {
    const socket = getSocket()
    if (socket) socket.emit('typing', { conversationId })
  },

  stopTyping: (conversationId) => {
    const socket = getSocket()
    if (socket) socket.emit('stop_typing', { conversationId })
  },

  // Recibir indicador de escritura de otro usuario
  setUserTyping: (conversationId, username) => {
    set(state => ({
      typingUsers: { ...state.typingUsers, [conversationId]: username }
    }))
    // Auto-limpiar después de 3 segundos
    setTimeout(() => {
      set(state => {
        const updated = { ...state.typingUsers }
        delete updated[conversationId]
        return { typingUsers: updated }
      })
    }, 3000)
  },

  clearTyping: (conversationId) => {
    set(state => {
      const updated = { ...state.typingUsers }
      delete updated[conversationId]
      return { typingUsers: updated }
    })
  },

  // Iniciar un nuevo DM con otro usuario
  startDM: async (targetUserId) => {
    try {
      const data = await api.post('/conversations', { targetUserId })
      await get().loadConversations()
      await get().setActiveConversation(data.conversation)
      return data.conversation
    } catch (err) {
      console.error('Failed to start DM:', err)
      throw err
    }
  },

  // Buscar usuarios por nombre
  searchUsers: async (query) => {
    if (!query || query.length < 2) return []
    try {
      const data = await api.get(`/users/search?q=${encodeURIComponent(query)}`)
      return data.users || []
    } catch (err) {
      console.error('Failed to search users:', err)
      return []
    }
  },

  deleteConversation: async (conversationId) => {
    try {
      await api.delete(`/conversations/${conversationId}`)
      set(state => {
        const conversations = state.conversations.filter(c => c.id !== conversationId)
        const isActive = state.activeConversation?.id === conversationId
        return {
          conversations,
          activeConversation: isActive ? null : state.activeConversation,
          messages: isActive ? [] : state.messages,
        }
      })
      return true
    } catch (err) {
      console.error('Delete conversation error:', err)
      return false
    }
  },

  // Marcar mensajes como vistos — emitir al server
  markSeen: (conversationId) => {
    const socket = getSocket()
    if (socket && conversationId) {
      socket.emit('mark_seen', { conversationId })
    }
  },

  // Recibir confirmación de que mensajes fueron vistos
  handleMessagesSeen: ({ conversationId, messageIds, seenAt }) => {
    set(state => {
      if (state.activeConversation?.id !== conversationId) return state
      const messages = state.messages.map(m =>
        messageIds.includes(m.id) ? { ...m, seen_at: seenAt } : m
      )
      return { messages }
    })
  },
}))

export default useChatStore
