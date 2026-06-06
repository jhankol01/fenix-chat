import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import { query } from '../config/database.js'

// GET /api/conversations
export async function getConversations(req, res, next) {
  try {
    const conversations = await Conversation.getByUser(req.user.id)
    res.json(conversations)
  } catch (err) {
    next(err)
  }
}

// POST /api/conversations
export async function createConversation(req, res, next) {
  try {
    const { targetUserId } = req.body

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId es requerido' })
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'No puedes crear una conversación contigo mismo' })
    }

    // Verify target user exists
    const targetCheck = await query(
      'SELECT id, username FROM users WHERE id = $1',
      [targetUserId]
    )
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const conversationId = await Conversation.getOrCreateDM(req.user.id, targetUserId)
    const conversation = await Conversation.findById(conversationId)
    const members = await Conversation.getMembers(conversationId)

    res.status(201).json({
      ...conversation,
      members,
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/conversations/:id/messages
export async function getMessages(req, res, next) {
  try {
    const { id } = req.params
    const { before, limit } = req.query

    // Verify user is a member of the conversation
    const isMember = await Conversation.isMember(id, req.user.id)
    if (!isMember) {
      return res.status(403).json({ error: 'No tienes acceso a esta conversación' })
    }

    const messages = await Message.getByConversation(id, {
      limit: limit ? parseInt(limit, 10) : 50,
      before: before || null,
    })

    res.json(messages)
  } catch (err) {
    next(err)
  }
}

// GET /api/users/search?q=
export async function searchUsers(req, res, next) {
  try {
    const { q } = req.query

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Query debe tener al menos 2 caracteres' })
    }

    const result = await query(
      `SELECT id, username, display_name, avatar_url
       FROM users
       WHERE (username ILIKE $1 OR display_name ILIKE $1)
         AND id != $2
         AND is_verified = TRUE
       ORDER BY username ASC
       LIMIT 20`,
      [`%${q.trim()}%`, req.user.id]
    )

    res.json(result.rows)
  } catch (err) {
    next(err)
  }
}
