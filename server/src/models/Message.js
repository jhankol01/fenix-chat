import { query } from '../config/database.js'

const Message = {
  /**
   * Create a new message and return it with sender info.
   */
  async create({ conversationId, senderId, content, type = 'text' }) {
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_id, content, type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, conversation_id, sender_id, content, type, created_at`,
      [conversationId, senderId, content, type]
    )

    const message = result.rows[0]

    // Fetch sender info
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
        u.username AS sender_username,
        u.display_name AS sender_display_name,
        u.avatar_url AS sender_avatar_url
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      params
    )

    // Reverse to get chronological order (query uses DESC for cursor pagination)
    return result.rows.reverse()
  },
}

export default Message
