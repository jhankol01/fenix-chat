import { Router } from 'express'
import { getMe, updateMe } from '../controllers/users.js'
import authenticate from '../middleware/auth.js'
import { query } from '../config/database.js'

const router = Router()

router.get('/me', authenticate, getMe)
router.patch('/me', authenticate, updateMe)

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

export default router
