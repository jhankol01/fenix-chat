import { query } from '../config/database.js'

const Preferences = {
  async get(userId) {
    let result = await query(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [userId]
    )
    if (result.rows.length === 0) {
      await query(
        `INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [userId]
      )
      result = await query(`SELECT * FROM user_preferences WHERE user_id = $1`, [userId])
    }
    return result.rows[0]
  },

  async update(userId, updates) {
    const { chat_bg, theme } = updates
    const result = await query(
      `INSERT INTO user_preferences (user_id, chat_bg, theme, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         chat_bg = COALESCE($2, user_preferences.chat_bg),
         theme = COALESCE($3, user_preferences.theme),
         updated_at = NOW()
       RETURNING *`,
      [userId, chat_bg || null, theme || null]
    )
    return result.rows[0]
  },
}

export default Preferences
