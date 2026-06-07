import { query } from '../config/database.js'

const Message = {
  /**
   * Create a new message and return it with sender info.
   */
  async create({ conversationId, senderId, content, type = 'text', replyToId = null, forwarded = false }) {
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_id, content, type, reply_to_id, forwarded)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, conversation_id, sender_id, content, type, created_at, seen_at, reply_to_id, forwarded`,
      [conversationId, senderId, content, type, replyToId, forwarded]
    )

    const message = result.rows[0]

    const senderResult = await query(
      'SELECT username, display_name, avatar_url FROM users WHERE id = $1',
      [senderId]
    )

    const sender = senderResult.rows[0]
    return {
      ...message,
      sender_username: sender?.username || null,
      sender_display_name: sender?.display_name || null,
      sender_avatar_url: sender?.avatar_url || null,
    }
  },

  async findById(messageId) {
    const result = await query(
      `SELECT m.*, u.username as sender_username, u.display_name as sender_display_name
       FROM messages m LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1`,
      [messageId]
    )
    return result.rows[0] || null
  },

  /**
   * Get messages for a conversation with cursor-based pagination.
   * @param {string} conversationId
   * @param {object} options - { limit, before } where before is an ISO timestamp cursor
   */
  async getByConversation(conversationId, { limit = 50, before = null } = {}) {
    const params = [conversationId, Math.min(limit, 100)]
    let whereClause = 'WHERE m.conversation_id = $1'

    if (before) {
      whereClause += ' AND m.created_at < $3'
      params.push(before)
    }

    const result = await query(
      `SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        m.content,
        m.type,
        m.created_at,
        m.seen_at,
        m.reply_to_id,
        m.forwarded,
        m.deleted_at,
        u.username AS sender_username,
        u.display_name AS sender_display_name,
        u.avatar_url AS sender_avatar_url,
        rm.content AS reply_content,
        rm.type AS reply_type,
        ru.username AS reply_username
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.sender_id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      params
    )

    return result.rows.reverse()
  },

  /**
   * Delete a message. Only the sender can delete their own message.
   */
  async delete(messageId, userId) {
    const result = await query(
      'DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING id, conversation_id',
      [messageId, userId]
    )
    return result.rows[0] || null
  },

  /**
   * Mark all messages in a conversation as seen (except own messages).
   * Returns the IDs of messages that were marked.
   */
  async markSeen(conversationId, userId) {
    const result = await query(
      `UPDATE messages
       SET seen_at = NOW()
       WHERE conversation_id = $1
         AND sender_id != $2
         AND seen_at IS NULL
       RETURNING id, sender_id`,
      [conversationId, userId]
    )
    return result.rows
  },
}

export default Message
