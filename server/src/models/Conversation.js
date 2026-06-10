import { query, getClient } from '../config/database.js'

const Conversation = {
  /**
   * Get all conversations for a user with last message and other member info.
   */
  async getByUser(userId) {
    const result = await query(
      `SELECT
        c.id,
        c.type,
        c.name,
        c.created_at,
        -- Last message info
        m.id AS last_message_id,
        m.content AS last_message_content,
        m.type AS last_message_type,
        m.created_at AS last_message_at,
        m_sender.username AS last_message_sender,
        -- Other member info (for DMs)
        other.id AS other_user_id,
        other.username AS other_username,
        other.display_name AS other_display_name,
        other.avatar_url AS other_avatar_url,
        other.status_text AS other_status_text,
        other.status_emoji AS other_status_emoji
      FROM conversations c
      JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
      -- Get the latest message per conversation
      LEFT JOIN LATERAL (
        SELECT id, content, type, sender_id, created_at
        FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON true
      LEFT JOIN users m_sender ON m_sender.id = m.sender_id
      -- Get the other member (for DMs, pick one that isn't the current user)
      LEFT JOIN LATERAL (
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.status_text, u.status_emoji
        FROM conversation_members cm2
        JOIN users u ON u.id = cm2.user_id
        WHERE cm2.conversation_id = c.id AND cm2.user_id != $1
        LIMIT 1
      ) other ON true
      ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
      [userId]
    )
    return result.rows
  },

  /**
   * Find an existing DM between two users, or create a new one.
   */
  async getOrCreateDM(userId1, userId2) {
    // Look for an existing DM that contains both users
    const existing = await query(
      `SELECT c.id FROM conversations c
       WHERE c.type = 'dm'
         AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $1)
         AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $2)`,
      [userId1, userId2]
    )

    if (existing.rows.length > 0) {
      return existing.rows[0].id
    }

    // Create new DM conversation within a transaction
    const client = await getClient()
    try {
      await client.query('BEGIN')

      const convResult = await client.query(
        `INSERT INTO conversations (type) VALUES ('dm') RETURNING id`,
      )
      const conversationId = convResult.rows[0].id

      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
        [conversationId, userId1, userId2]
      )

      await client.query('COMMIT')
      return conversationId
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  /**
   * Get a conversation by ID.
   */
  async findById(id) {
    const result = await query(
      'SELECT id, type, name, created_at FROM conversations WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  /**
   * Get all members of a conversation.
   */
  async getMembers(conversationId) {
    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status_text, u.status_emoji, cm.joined_at
       FROM conversation_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = $1
       ORDER BY cm.joined_at ASC`,
      [conversationId]
    )
    return result.rows
  },

  /**
   * Check if a user is a member of a conversation.
   */
  async isMember(conversationId, userId) {
    const result = await query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    )
    return result.rows.length > 0
  },

  async delete(conversationId, userId) {
    // Verify user is member
    const isMember = await query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    )
    if (isMember.rows.length === 0) return false
    
    // Delete messages first, then members, then conversation
    const client = await getClient()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM messages WHERE conversation_id = $1', [conversationId])
      await client.query('DELETE FROM conversation_members WHERE conversation_id = $1', [conversationId])
      await client.query('DELETE FROM conversations WHERE id = $1', [conversationId])
      await client.query('COMMIT')
      return true
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  /**
   * Clear all messages in a conversation (keep conversation + members).
   */
  async clearMessages(conversationId, userId) {
    const isMember = await query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    )
    if (isMember.rows.length === 0) return false

    await query('DELETE FROM messages WHERE conversation_id = $1', [conversationId])
    return true
  },

  /**
   * Create a group conversation with multiple members.
   */
  async createGroup(creatorId, name, memberIds = []) {
    const client = await getClient()
    try {
      await client.query('BEGIN')

      const convResult = await client.query(
        `INSERT INTO conversations (type, name) VALUES ('group', $1) RETURNING id, type, name, created_at`,
        [name]
      )
      const conv = convResult.rows[0]

      // Add creator + all members
      const allMembers = [creatorId, ...memberIds.filter(id => id !== creatorId)]
      for (const memberId of allMembers) {
        await client.query(
          `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [conv.id, memberId, memberId === creatorId ? 'admin' : 'member']
        )
      }

      await client.query('COMMIT')
      return conv
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  /**
   * Add a member to a group conversation.
   */
  async addMember(conversationId, userId) {
    await query(
      `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT DO NOTHING`,
      [conversationId, userId]
    )
  },

  /**
   * Remove a member from a group conversation.
   */
  async removeMember(conversationId, userId) {
    await query(
      'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    )
  },
}

export default Conversation
