import jwt from 'jsonwebtoken'
import config from '../config/index.js'
import Message from '../models/Message.js'
import Conversation from '../models/Conversation.js'
import logger from '../utils/logger.js'

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map()
export { onlineUsers }

/**
 * Register socket.io event handlers.
 * @param {import('socket.io').Server} io
 */
export default function chatHandler(io) {
  // ─── Authentication Middleware ──────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      return next(new Error('Token de acceso requerido'))
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret)
      socket.user = { id: decoded.id, email: decoded.email, username: decoded.username }
      next()
    } catch (err) {
      return next(new Error('Token inválido'))
    }
  })

  // ─── Connection ─────────────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const { user } = socket
    logger.info(`Socket connected: ${user.username} (${socket.id})`)

    // Track online status
    if (!onlineUsers.has(user.id)) {
      onlineUsers.set(user.id, new Set())
    }
    onlineUsers.get(user.id).add(socket.id)

    // Auto-join ALL conversation rooms for this user
    try {
      const conversations = await Conversation.getByUser(user.id)
      const convList = Array.isArray(conversations) ? conversations : []
      for (const conv of convList) {
        socket.join(conv.id)
      }
      logger.info(`${user.username} auto-joined ${convList.length} conversation rooms`)
    } catch (err) {
      logger.error('Error auto-joining conversations:', err.message)
    }

    // Broadcast that user is online
    socket.broadcast.emit('user_online', { userId: user.id, username: user.username })

    // Send current online user list to the newly connected socket
    const onlineUserIds = Array.from(onlineUsers.keys())
    socket.emit('online_users', onlineUserIds)

    // ─── Join Conversation Room ───────────────────────────────────────────────
    socket.on('join_conversation', async (conversationId) => {
      try {
        // Verify the user is a member of this conversation
        const isMember = await Conversation.isMember(conversationId, user.id)
        if (!isMember) {
          return socket.emit('error_message', { error: 'No tienes acceso a esta conversación' })
        }

        socket.join(conversationId)
        logger.debug(`${user.username} joined room: ${conversationId}`)
      } catch (err) {
        logger.error('Error joining conversation:', err.message)
        socket.emit('error_message', { error: 'Error al unirse a la conversación' })
      }
    })

    // ─── Leave Conversation Room ──────────────────────────────────────────────
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(conversationId)
      logger.debug(`${user.username} left room: ${conversationId}`)
    })

    // ─── Send Message ─────────────────────────────────────────────────────────
    socket.on('send_message', async ({ conversationId, content, type = 'text' }) => {
      try {
        if (!conversationId || !content) {
          return socket.emit('error_message', { error: 'conversationId y content son requeridos' })
        }

        // Verify membership
        const isMember = await Conversation.isMember(conversationId, user.id)
        if (!isMember) {
          return socket.emit('error_message', { error: 'No tienes acceso a esta conversación' })
        }

        // Save message to database
        const message = await Message.create({
          conversationId,
          senderId: user.id,
          content: type === 'text' ? content.trim() : content,
          type,
        })

        // Broadcast to all members in the conversation room (including sender)
        io.to(conversationId).emit('new_message', message)

        // Also ensure both users are in the room (for new conversations)
        const members = await Conversation.getMembers(conversationId)
        for (const member of members) {
          const memberSockets = onlineUsers.get(member.id)
          if (memberSockets) {
            for (const socketId of memberSockets) {
              const memberSocket = io.sockets.sockets.get(socketId)
              if (memberSocket) memberSocket.join(conversationId)
            }
          }
        }

        logger.debug(`Message from ${user.username} in ${conversationId}: ${content.substring(0, 50)}`)
      } catch (err) {
        logger.error('Error sending message:', err.message)
        socket.emit('error_message', { error: 'Error al enviar el mensaje' })
      }
    })

    // ─── Typing Indicators ────────────────────────────────────────────────────
    socket.on('typing', ({ conversationId }) => {
      socket.to(conversationId).emit('user_typing', {
        conversationId,
        userId: user.id,
        username: user.username,
      })
    })

    socket.on('stop_typing', ({ conversationId }) => {
      socket.to(conversationId).emit('user_stop_typing', {
        conversationId,
        userId: user.id,
      })
    })

    // ─── Delete Message ──────────────────────────────────────────────────────
    socket.on('delete_message', async ({ messageId, conversationId }) => {
      try {
        const deleted = await Message.delete(messageId, user.id)
        if (deleted) {
          io.to(conversationId).emit('message_deleted', { messageId, conversationId })
          logger.info(`🗑️ ${user.username} deleted message ${messageId}`)
        }
      } catch (err) {
        logger.error('Error deleting message:', err.message)
      }
    })

    // ─── WebRTC Call Signaling ─────────────────────────────────────────────────

    // Helper: send a call notification message to the conversation
    const sendCallMsg = async (userId1, userId2, content) => {
      try {
        const convId = await Conversation.getOrCreateDM(userId1, userId2)
        const message = await Message.create({
          conversationId: convId,
          senderId: userId1,
          content,
          type: 'system',
        })
        io.to(convId).emit('new_message', message)
      } catch (err) {
        logger.error('Error sending call message:', err.message)
      }
    }

    // Initiate a call
    socket.on('call_user', ({ targetUserId, offer, callerName, callerAvatar }) => {
      logger.info(`📞 Call attempt: ${user.username} (${user.id}) → target: ${targetUserId}`)
      
      const targetSockets = onlineUsers.get(targetUserId)
      if (targetSockets && targetSockets.size > 0) {
        for (const sid of targetSockets) {
          io.to(sid).emit('incoming_call', {
            callerId: user.id,
            callerName: callerName || user.username,
            callerAvatar,
            offer,
          })
        }
        logger.info(`📞 ${user.username} calling user ${targetUserId} (${targetSockets.size} sockets)`)
      } else {
        // User not online → missed call
        sendCallMsg(user.id, targetUserId, `📞 Llamada perdida de ${user.username}`)
        socket.emit('call_unavailable', { reason: 'El usuario no está en línea' })
      }
    })

    // Accept call — send answer back to caller
    socket.on('call_accepted', ({ callerId, answer }) => {
      const callerSockets = onlineUsers.get(callerId)
      if (callerSockets) {
        for (const sid of callerSockets) {
          io.to(sid).emit('call_answered', { answer, answererId: user.id })
        }
      }
    })

    // Reject call → missed call notification
    socket.on('call_rejected', ({ callerId }) => {
      const callerSockets = onlineUsers.get(callerId)
      if (callerSockets) {
        for (const sid of callerSockets) {
          io.to(sid).emit('call_rejected_response', { reason: 'Llamada rechazada' })
        }
      }
      sendCallMsg(callerId, user.id, `📞 Llamada perdida`)
    })

    // ICE candidate relay
    socket.on('ice_candidate', ({ targetUserId, candidate }) => {
      const targetSockets = onlineUsers.get(targetUserId)
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit('ice_candidate', { candidate, fromUserId: user.id })
        }
      }
    })

    // End call → notification
    socket.on('end_call', ({ targetUserId, duration }) => {
      const targetSockets = onlineUsers.get(targetUserId)
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit('call_ended', { userId: user.id })
        }
      }
      // Send call ended message
      if (duration && duration > 0) {
        const m = Math.floor(duration / 60)
        const s = duration % 60
        sendCallMsg(user.id, targetUserId, `📞 Llamada · ${m}:${s.toString().padStart(2, '0')}`)
      } else {
        sendCallMsg(user.id, targetUserId, `📞 Llamada perdida`)
      }
    })

    // ─── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${user.username} (${reason})`)

      // Remove socket from online tracking
      const userSockets = onlineUsers.get(user.id)
      if (userSockets) {
        userSockets.delete(socket.id)
        // If user has no more active sockets, they're offline
        if (userSockets.size === 0) {
          onlineUsers.delete(user.id)
          socket.broadcast.emit('user_offline', { userId: user.id, username: user.username })
        }
      }
    })
  })
}
