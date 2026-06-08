import { Router } from 'express'
import { getMe, updateMe, updatePrivacy } from '../controllers/users.js'
import authenticate from '../middleware/auth.js'
import { query } from '../config/database.js'

const router = Router()

router.get('/me', authenticate, getMe)
router.patch('/me', authenticate, updateMe)
router.patch('/me/privacy', authenticate, updatePrivacy)

// DELETE /api/users/me — Delete own account
router.delete('/me', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1', [req.user.id])
    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting account:', err.message)
    res.status(500).json({ error: 'Error eliminando cuenta' })
  }
})

// POST /api/users/block/:userId — Block a user
router.post('/block/:userId', authenticate, async (req, res) => {
  try {
    const blockedId = req.params.userId
    if (blockedId === req.user.id) return res.status(400).json({ error: 'No puedes bloquearte a ti mismo' })
    await query(
      'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, blockedId]
    )
    res.json({ success: true, blocked: true })
  } catch (err) {
    console.error('Error blocking user:', err.message)
    res.status(500).json({ error: 'Error bloqueando usuario' })
  }
})

// DELETE /api/users/block/:userId — Unblock a user
router.delete('/block/:userId', authenticate, async (req, res) => {
  try {
    const blockedId = req.params.userId
    await query(
      'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
      [req.user.id, blockedId]
    )
    res.json({ success: true, blocked: false })
  } catch (err) {
    console.error('Error unblocking user:', err.message)
    res.status(500).json({ error: 'Error desbloqueando usuario' })
  }
})

// GET /api/users/blocked — List blocked users
router.get('/blocked', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, bu.created_at as blocked_at
       FROM blocked_users bu
       JOIN users u ON u.id = bu.blocked_id
       WHERE bu.blocker_id = $1
       ORDER BY bu.created_at DESC`,
      [req.user.id]
    )
    res.json({ blocked: result.rows })
  } catch (err) {
    console.error('Error listing blocked:', err.message)
    res.status(500).json({ error: 'Error' })
  }
})

export default router
