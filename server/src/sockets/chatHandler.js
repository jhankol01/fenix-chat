import jwt from 'jsonwebtoken'
import config from '../config/index.js'
import Message from '../models/Message.js'
import Conversation from '../models/Conversation.js'
import Reaction from '../models/Reaction.js'
import pool, { query } from '../config/database.js'
import logger from '../utils/logger.js'
import { sendPushToUser } from '../routes/pushRoutes.js'
import { getAIResponse, getBotUserId, parseAndSaveIdeas, cleanBotResponse } from '../services/aiBot.js'

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

          // Send push notification to OFFLINE members
          if (member.id !== user.id && (!memberSockets || memberSockets.size === 0)) {
            const truncated = (type === 'text' && content.length > 80) ? content.slice(0, 80) + '...' : content
            const body = type === 'text' ? truncated : (type === 'image' ? '📷 Imagen' : type === 'audio' ? '🎤 Audio' : type === 'video' ? '🎬 Video' : '📎 Archivo')
            sendPushToUser(member.id, {
              title: `${user.username}`,
              body,
              tag: `fenix-msg-${conversationId}`,
              conversationId,
              url: '/',
            })
          }
        }

        logger.debug(`Message from ${user.username} in ${conversationId}: ${content.substring(0, 50)}`)

        // ─── Fenix IA Bot Response ───
        try {
          const botUserId = await getBotUserId(pool)
          if (botUserId && botUserId !== user.id) {
            // Check if the other user in this conversation is the bot
            const botCheck = await query(
              'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
              [conversationId, botUserId]
            )
            if (botCheck.rows.length > 0) {
              // Check if user has AI access
              const accessCheck = await query('SELECT ai_access FROM users WHERE id = $1', [user.id])
              if (!accessCheck.rows[0]?.ai_access) {
                // No access — send a locked message
                const lockedMsg = await Message.create({
                  conversationId,
                  senderId: botUserId,
                  content: '🔒 **Acceso restringido**\n\nFenix IA está en **beta cerrada**. Necesitas una clave de acceso para chatear conmigo.\n\nContacta al administrador para obtener tu clave. 🔑',
                  type: 'text'
                })
                io.to(conversationId).emit('new_message', lockedMsg)
              } else {
              // Bot is in this conversation - generate AI response
              io.to(conversationId).emit('user_typing', { conversationId, userId: botUserId, username: 'Fenix IA' })

              // Get recent messages for context
              const historyResult = await query(
                `SELECT m.content, u.is_bot FROM messages m
                 JOIN users u ON u.id = m.sender_id
                 WHERE m.conversation_id = $1 AND m.deleted_at IS NULL
                 ORDER BY m.created_at DESC LIMIT 10`,
                [conversationId]
              )
              const history = historyResult.rows.reverse()

              const aiResponse = await getAIResponse(content, history, user.id, pool)

              // Parse and save any ideas from the bot's response
              await parseAndSaveIdeas(aiResponse, user.id, pool)

              // Clean the response (remove [IDEA_SAVE] blocks from visible message)
              const cleanedResponse = cleanBotResponse(aiResponse)

              // Save bot's response
              const botMsg = await Message.create({
                conversationId,
                senderId: botUserId,
                content: cleanedResponse,
                type: 'text'
              })

              io.to(conversationId).emit('user_stop_typing', { conversationId, userId: botUserId })
              io.to(conversationId).emit('new_message', botMsg)

              // Update conversation last message
              await query(
                'UPDATE conversations SET last_message_at = NOW(), last_message_content = $1, last_message_sender = $2 WHERE id = $3',
                [cleanedResponse.slice(0, 100), 'Fenix IA', conversationId]
              ).catch(() => {})
              } // close else (ai_access)
            }
          }
        } catch (botErr) {
          console.error('Fenix IA bot error:', botErr)
          io.to(conversationId).emit('user_stop_typing', { conversationId })
        }

        // ─── Empire Call Reply Bridge ───
        // When admin replies in Empire Call conversation, forward to Empire
        try {
          const empireCheck = await query(
            `SELECT u.username FROM conversation_members cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.conversation_id = $1 AND u.username = 'Empire Call'`,
            [conversationId]
          )
          if (empireCheck.rows.length > 0) {
            // Admin is replying to Empire Call — forward to Empire
            const fetch = (await import('node-fetch')).default
            fetch('https://ssnempire.shop/admin_reply.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                secret: 'fenix-empire-2024-secure',
                message: content,
                target_user: '', // last escalated user
              }),
            }).catch(err => logger.error('Empire reply forward error:', err.message))
            logger.info(`Forwarded admin reply to Empire Call: ${content.slice(0, 50)}`)
          }
        } catch (empireErr) {
          logger.error('Empire bridge error:', empireErr.message)
        }
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

    // ─── Create Group ─────────────────────────────────────────────────────────
    socket.on('create_group', async ({ name, memberIds }) => {
      try {
        if (!name || !memberIds || memberIds.length === 0) {
          return socket.emit('error_message', { error: 'Nombre y miembros son requeridos' })
        }
        const conv = await Conversation.createGroup(user.id, name, memberIds)

        // Join all online members to the new room
        const allMembers = [user.id, ...memberIds.filter(id => id !== user.id)]
        for (const memberId of allMembers) {
          const memberSockets = onlineUsers.get(memberId)
          if (memberSockets) {
            for (const sid of memberSockets) {
              const memberSocket = io.sockets.sockets.get(sid)
              if (memberSocket) memberSocket.join(conv.id)
            }
          }
        }

        // Send system message
        const sysMsg = await Message.create({
          conversationId: conv.id,
          senderId: user.id,
          content: `${user.username} creó el grupo "${name}"`,
          type: 'system',
        })
        io.to(conv.id).emit('new_message', sysMsg)

        // Notify all members to reload conversations
        for (const memberId of allMembers) {
          const memberSockets = onlineUsers.get(memberId)
          if (memberSockets) {
            for (const sid of memberSockets) {
              io.to(sid).emit('group_created', { conversation: conv })
            }
          }
        }

        logger.info(`Group "${name}" created by ${user.username} with ${allMembers.length} members`)
      } catch (err) {
        logger.error('Error creating group:', err.message)
        socket.emit('error_message', { error: 'Error al crear el grupo' })
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

    // ─── Community Channel Events ─────────────────────────────────────────────
    socket.on('join_channel', ({ channelId }) => {
      if (channelId) {
        socket.join(`channel:${channelId}`)
      }
    })

    socket.on('leave_channel', ({ channelId }) => {
      if (channelId) {
        socket.leave(`channel:${channelId}`)
      }
    })

    socket.on('channel_message', async ({ channelId, content, type }) => {
      try {
        if (!channelId || !content?.trim()) return
        const { default: Channel } = await import('../models/Channel.js')
        const message = await Channel.sendMessage({
          channelId,
          userId: user.id,
          content: content.trim(),
          type: type || 'text',
        })
        io.to(`channel:${channelId}`).emit('channel_message', message)
      } catch (err) {
        logger.error('channel_message error:', err.message)
      }
    })

    socket.on('channel_typing', ({ channelId }) => {
      if (channelId) {
        socket.to(`channel:${channelId}`).emit('channel_typing', {
          channelId,
          userId: user.id,
          username: user.username,
        })
      }
    })

    // Voice room presence (tracked in-memory + DB)
    socket.on('join_voice_room', async ({ roomId }) => {
      try {
        if (!roomId) return

        // Get existing participants BEFORE joining
        const existingRes = await query(
          `SELECT vp.user_id AS "userId", u.username, u.display_name, u.avatar_url 
           FROM voice_participants vp 
           JOIN users u ON vp.user_id = u.id 
           WHERE vp.room_id = $1`,
          [roomId]
        )
        const existingUsers = existingRes.rows

        // Join socket room and DB
        socket.join(`voice:${roomId}`)
        await query(
          `INSERT INTO voice_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [roomId, user.id]
        )
        const userRes = await query(
          `SELECT username, display_name, avatar_url FROM users WHERE id = $1`, [user.id]
        )

        // Send existing users to the new joiner (so they can create offers)
        socket.emit('voice_room_users', {
          roomId,
          users: existingUsers.filter(u => u.userId !== user.id),
        })

        // Broadcast new joiner to everyone else in the room
        socket.to(`voice:${roomId}`).emit('voice_user_joined', {
          roomId, userId: user.id, ...userRes.rows[0],
        })
      } catch (err) {
        logger.error('join_voice_room error:', err.message)
      }
    })

    socket.on('leave_voice_room', async ({ roomId }) => {
      try {
        if (!roomId) return
        socket.leave(`voice:${roomId}`)
        await query(
          `DELETE FROM voice_participants WHERE room_id = $1 AND user_id = $2`,
          [roomId, user.id]
        )
        io.to(`voice:${roomId}`).emit('voice_user_left', { roomId, userId: user.id })
      } catch (err) {
        logger.error('leave_voice_room error:', err.message)
      }
    })

    // WebRTC signaling relay for voice rooms
    socket.on('voice_offer', ({ to, offer }) => {
      // Find target user's socket and send offer
      const targetSockets = onlineUsers.get(to)
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit('voice_offer', { from: user.id, offer })
        }
      }
    })

    socket.on('voice_answer', ({ to, answer }) => {
      const targetSockets = onlineUsers.get(to)
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit('voice_answer', { from: user.id, answer })
        }
      }
    })

    socket.on('voice_ice', ({ to, candidate }) => {
      const targetSockets = onlineUsers.get(to)
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit('voice_ice', { from: user.id, candidate })
        }
      }
    })

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
