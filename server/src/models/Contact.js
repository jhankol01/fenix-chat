import { query } from '../config/database.js'

const Contact = {
  /**
   * Get all contacts for a user with their profile info.
   */
  async getByUser(userId) {
    const result = await query(
      `SELECT c.id, c.contact_id, c.nickname, c.created_at,
              u.username, u.display_name, u.avatar_url, u.status_text, u.status_emoji
       FROM contacts c
       JOIN users u ON u.id = c.contact_id
       WHERE c.user_id = $1
       ORDER BY COALESCE(c.nickname, u.username) ASC`,
      [userId]
    )
    return result.rows
  },

  /**
   * Add a contact.
   */
  async add(userId, contactId, nickname = null) {
    const result = await query(
      `INSERT INTO contacts (user_id, contact_id, nickname)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, contact_id) DO NOTHING
       RETURNING id`,
      [userId, contactId, nickname]
    )
    return result.rows[0] || null
  },

  /**
   * Remove a contact.
   */
  async remove(userId, contactId) {
    const result = await query(
      `DELETE FROM contacts WHERE user_id = $1 AND contact_id = $2 RETURNING id`,
      [userId, contactId]
    )
    return result.rows[0] || null
  },

  /**
   * Check if a user is in contacts.
   */
  async isContact(userId, contactId) {
    const result = await query(
      `SELECT id FROM contacts WHERE user_id = $1 AND contact_id = $2`,
      [userId, contactId]
    )
    return result.rows.length > 0
  },
}

export default Contact
