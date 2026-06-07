import jwt from 'jsonwebtoken'
import config from '../config/index.js'
import Message from '../models/Message.js'
import Conversation from '../models/Conversation.js'
import Reaction from '../models/Reaction.js'
import { query } from '../config/database.js'
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
    // Update DB presence
    query('UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = $1', [user.id]).catch(() => {})

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
    socket.on('send_message', async ({ conversationId, content, type = 'text', replyToId = null, forwarded = false }) => {
      try {
        if (!conversationId || !content) {
          return socket.emit('error_message', { error: 'conversationId y content son requeridos' })
        }

        const isMember = await Conversation.isMember(conversationId, user.id)
        if (!isMember) {
          return socket.emit('error_message', { error: 'No tienes acceso a esta conversación' })
        }

        const message = await Message.create({
          conversationId,
          senderId: user.id,
          content: type === 'text' ? content.trim() : content,
          type,
          replyToId: replyToId || null,
          forwarded: forwarded || false,
        })

        // If replying, attach the replied-to message
        if (replyToId) {
          const repliedTo = await Message.findById(replyToId)
          if (repliedTo) message.reply_to = repliedTo
        }
        if (forwarded) message.forwarded = true

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
    socket.on('typing', async ({ conversationId }) => {
      const payload = {
        conversationId,
        userId: user.id,
        username: user.username,
      }
      // Broadcast to room
      socket.to(conversationId).emit('user_typing', payload)
      // Also send directly to each member's sockets (fallback if room join failed)
      try {
        const members = await Conversation.getMembers(conversationId)
        for (const member of members) {
          if (member.id === user.id) continue
          const memberSockets = onlineUsers.get(member.id)
          if (memberSockets) {
            for (const sid of memberSockets) {
              io.to(sid).emit('user_typing', payload)
            }
          }
        }
      } catch (_) {}
    })

    socket.on('stop_typing', async ({ conversationId }) => {
      const payload = { conversationId, userId: user.id }
      socket.to(conversationId).emit('user_stop_typing', payload)
      try {
        const members = await Conversation.getMembers(conversationId)
        for (const member of members) {
          if (member.id === user.id) continue
          const memberSockets = onlineUsers.get(member.id)
          if (memberSockets) {
            for (const sid of memberSockets) {
              io.to(sid).emit('user_stop_typing', payload)
            }
          }
        }
      } catch (_) {}
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

    // ─── Delete for Everyone ──────────────────────────────────────────────────
    socket.on('delete_for_all', async ({ messageId, conversationId }) => {
      try {
        await query(
          `UPDATE messages SET deleted_at = NOW(), content = '' WHERE id = $1 AND sender_id = $2`,
          [messageId, user.id]
        )
        io.to(conversationId).emit('message_deleted_for_all', { messageId, conversationId })
        logger.info(`🗑️ ${user.username} deleted message ${messageId} for everyone`)
      } catch (err) {
        logger.error('Error deleting for all:', err.message)
      }
    })

    // ─── Reactions ────────────────────────────────────────────────────────────
    socket.on('add_reaction', async ({ messageId, conversationId, emoji }) => {
      try {
        await Reaction.add(messageId, user.id, emoji)
        const reactions = await Reaction.getGroupedByMessage(messageId)
        io.to(conversationId).emit('reactions_updated', { messageId, reactions })
      } catch (err) {
        logger.error('Error adding reaction:', err.message)
      }
    })

    socket.on('remove_reaction', async ({ messageId, conversationId, emoji }) => {
      try {
        await Reaction.remove(messageId, user.id, emoji)
        const reactions = await Reaction.getGroupedByMessage(messageId)
        io.to(conversationId).emit('reactions_updated', { messageId, reactions })
      } catch (err) {
        logger.error('Error removing reaction:', err.message)
      }
    })

    // ─── Search Messages ─────────────────────────────────────────────────────
    socket.on('search_messages', async ({ conversationId, searchQuery }) => {
      try {
        const result = await query(
          `SELECT * FROM messages WHERE conversation_id = $1 AND content ILIKE $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`,
          [conversationId, `%${searchQuery}%`]
        )
        socket.emit('search_results', { conversationId, results: result.rows })
      } catch (err) {
        logger.error('Error searching messages:', err.message)
      }
    })

    // ─── Mark Messages as Seen (Read Receipts) ───────────────────────────────
    socket.on('mark_seen', async ({ conversationId }) => {
      try {
        const markedMessages = await Message.markSeen(conversationId, user.id)
        if (markedMessages.length > 0) {
          // Group by sender and notify each sender
          const senderIds = [...new Set(markedMessages.map(m => m.sender_id))]
          const messageIds = markedMessages.map(m => m.id)
          
          // Emit to the conversation room so sender's UI updates
          socket.to(conversationId).emit('messages_seen', {
            conversationId,
            messageIds,
            seenBy: user.id,
            seenAt: new Date().toISOString(),
          })
        }
      } catch (err) {
        logger.error('Error marking messages seen:', err.message)
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
    socket.on('call_user', ({ targetUserId, offer, callerName, callerAvatar, isVideoCall }) => {
      logger.info(`📞 Call attempt: ${user.username} (${user.id}) → target: ${targetUserId} video: ${!!isVideoCall}`)
      
      const targetSockets = onlineUsers.get(targetUserId)
      if (targetSockets && targetSockets.size > 0) {
        for (const sid of targetSockets) {
          io.to(sid).emit('incoming_call', {
            callerId: user.id,
            callerName: callerName || user.username,
            callerAvatar,
            offer,
            isVideoCall: !!isVideoCall,
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
          query('UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = $1', [user.id]).catch(() => {})
          socket.broadcast.emit('user_offline', { userId: user.id, username: user.username })
        }
      }
    })
  })
}
