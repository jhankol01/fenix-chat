import { query } from '../config/database.js'

const Reaction = {
  async getByMessage(messageId) {
    const result = await query(
      `SELECT r.id, r.emoji, r.user_id, u.username
       FROM reactions r JOIN users u ON u.id = r.user_id
       WHERE r.message_id = $1 ORDER BY r.created_at`,
      [messageId]
    )
    return result.rows
  },

  async add(messageId, userId, emoji) {
    const result = await query(
      `INSERT INTO reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING
       RETURNING id, emoji, user_id`,
      [messageId, userId, emoji]
    )
    return result.rows[0] || null
  },

  async remove(messageId, userId, emoji) {
    const result = await query(
      `DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 RETURNING id`,
      [messageId, userId, emoji]
    )
    return result.rows[0] || null
  },

  async getGroupedByMessage(messageId) {
    const result = await query(
      `SELECT emoji, COUNT(*)::int as count,
              ARRAY_AGG(u.username) as users,
              ARRAY_AGG(r.user_id) as user_ids
       FROM reactions r JOIN users u ON u.id = r.user_id
       WHERE r.message_id = $1
       GROUP BY emoji ORDER BY MIN(r.created_at)`,
      [messageId]
    )
    return result.rows
  },
}

export default Reaction
