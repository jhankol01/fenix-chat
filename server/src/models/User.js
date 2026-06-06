import { query } from '../config/database.js'

const User = {
  async create({ username, email, passwordHash, verifyToken, verifyExpires }) {
    const result = await query(
      `INSERT INTO users (username, email, password_hash, verify_token, verify_expires)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, display_name, avatar_url, status_text, status_emoji, is_verified, created_at`,
      [username, email, passwordHash, verifyToken, verifyExpires]
    )
    return result.rows[0]
  },

  async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email])
    return result.rows[0] || null
  },

  async findByUsername(username) {
    const result = await query('SELECT * FROM users WHERE username = $1', [username])
    return result.rows[0] || null
  },

  async findById(id) {
    const result = await query(
      'SELECT id, username, email, display_name, avatar_url, status_text, status_emoji, is_verified, created_at, updated_at FROM users WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  async verifyEmail(token) {
    const result = await query(
      `UPDATE users SET is_verified = TRUE, verify_token = NULL, verify_expires = NULL, updated_at = NOW()
       WHERE verify_token = $1 AND verify_expires > NOW() AND is_verified = FALSE
       RETURNING id, username, email`,
      [token]
    )
    return result.rows[0] || null
  },

  async updateProfile(id, { displayName, statusText, statusEmoji, avatarUrl }) {
    const fields = []
    const values = []
    let idx = 1

    if (displayName !== undefined) { fields.push(`display_name = $${idx++}`); values.push(displayName) }
    if (statusText !== undefined) { fields.push(`status_text = $${idx++}`); values.push(statusText) }
    if (statusEmoji !== undefined) { fields.push(`status_emoji = $${idx++}`); values.push(statusEmoji) }
    if (avatarUrl !== undefined) { fields.push(`avatar_url = $${idx++}`); values.push(avatarUrl) }

    if (fields.length === 0) return null

    fields.push(`updated_at = NOW()`)
    values.push(id)

    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, username, email, display_name, avatar_url, status_text, status_emoji, is_verified, created_at, updated_at`,
      values
    )
    return result.rows[0] || null
  },
  async deleteById(id) {
    await query('DELETE FROM users WHERE id = $1', [id])
  },

  async updateVerifyToken(id, verifyToken, verifyExpires) {
    await query(
      'UPDATE users SET verify_token = $1, verify_expires = $2, updated_at = NOW() WHERE id = $3',
      [verifyToken, verifyExpires, id]
    )
  },

  async setResetToken(id, resetToken, resetExpires) {
    await query(
      'UPDATE users SET reset_token = $1, reset_expires = $2, updated_at = NOW() WHERE id = $3',
      [resetToken, resetExpires, id]
    )
  },

  async findByResetToken(token) {
    const result = await query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_expires > NOW()',
      [token]
    )
    return result.rows[0] || null
  },

  async updatePassword(id, passwordHash) {
    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    )
  },
}

export default User
