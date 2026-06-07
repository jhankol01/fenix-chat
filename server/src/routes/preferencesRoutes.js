import { Router } from 'express'
import Preferences from '../models/Preferences.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// GET /api/preferences
router.get('/', authenticate, async (req, res) => {
  try {
    const prefs = await Preferences.get(req.user.id)
    res.json({ preferences: prefs })
  } catch (err) {
    console.error('Get preferences error:', err)
    res.status(500).json({ error: 'Error al obtener preferencias' })
  }
})

// PATCH /api/preferences
router.patch('/', authenticate, async (req, res) => {
  try {
    const prefs = await Preferences.update(req.user.id, req.body)
    res.json({ preferences: prefs })
  } catch (err) {
    console.error('Update preferences error:', err)
    res.status(500).json({ error: 'Error al actualizar preferencias' })
  }
})

export default router
