import { query } from '../config/database.js'

// GET /api/admin/users - List all users (filtered by privacy)
export async function listUsers(req, res, next) {
  try {
    const result = await query(
      `SELECT id, username, email, display_name, avatar_url, status_text, status_emoji, is_verified, created_at, updated_at
       FROM users
       WHERE (is_discoverable IS NOT FALSE OR id = $1)
         AND id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = $1)
         AND id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = $1)
       ORDER BY created_at DESC`,
      [req.user.id]
    )
    res.json({ users: result.rows, total: result.rows.length })
  } catch (err) {
    next(err)
  }
}

// GET /api/admin/stats - Basic stats
export async function getStats(req, res, next) {
  try {
    const usersResult = await query('SELECT COUNT(*) as count FROM users')
    const convResult = await query('SELECT COUNT(*) as count FROM conversations')
    const msgResult = await query('SELECT COUNT(*) as count FROM messages')
    const verifiedResult = await query('SELECT COUNT(*) as count FROM users WHERE is_verified = true')
    res.json({
      totalUsers: parseInt(usersResult.rows[0].count),
      totalConversations: parseInt(convResult.rows[0].count),
      totalMessages: parseInt(msgResult.rows[0].count),
      verifiedUsers: parseInt(verifiedResult.rows[0].count),
    })
  } catch (err) {
    next(err)
  }
}
