import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { query } from '../config/database.js'

const router = Router()

// POST /api/friend-requests — send friend request by @username
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { username } = req.body
    if (!username || username.trim().length < 2) {
      return res.status(400).json({ error: 'Usuario requerido' })
    }

    const targetRes = await query('SELECT id, username FROM users WHERE username = $1', [username.trim()])
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    const targetId = targetRes.rows[0].id

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'No puedes enviarte solicitud a ti mismo' })
    }

    // Check blocked
    const blocked = await query(
      'SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
      [req.user.id, targetId]
    )
    if (blocked.rows.length > 0) {
      return res.status(403).json({ error: 'No puedes enviar solicitud a este usuario' })
    }

    // Check if already contacts
    const alreadyContact = await query(
      'SELECT 1 FROM contacts WHERE user_id = $1 AND contact_id = $2',
      [req.user.id, targetId]
    )
    if (alreadyContact.rows.length > 0) {
      return res.status(400).json({ error: 'Ya tienes a este usuario en contactos' })
    }

    // Check if pending request already exists (either direction)
    const existing = await query(
      `SELECT id, status, sender_id FROM friend_requests 
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
      [req.user.id, targetId]
    )
    if (existing.rows.length > 0) {
      const ex = existing.rows[0]
      if (ex.status === 'pending') {
        // If THEY sent us a request, auto-accept it
        if (ex.sender_id === targetId) {
          await query(`UPDATE friend_requests SET status = 'accepted' WHERE id = $1`, [ex.id])
          await query('INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, targetId])
          await query('INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [targetId, req.user.id])
          return res.json({ message: 'Solicitud aceptada automáticamente', autoAccepted: true })
        }
        return res.status(400).json({ error: 'Ya enviaste una solicitud a este usuario' })
      }
      // If previously rejected, allow re-sending
      if (ex.status === 'rejected' && ex.sender_id === req.user.id) {
        await query(`UPDATE friend_requests SET status = 'pending', created_at = NOW() WHERE id = $1 RETURNING *`, [ex.id])
        return res.status(201).json({ request: { ...ex, status: 'pending' }, sent: true })
      }
    }

    const result = await query(
      `INSERT INTO friend_requests (sender_id, receiver_id) VALUES ($1, $2) RETURNING *`,
      [req.user.id, targetId]
    )
    res.status(201).json({ request: result.rows[0], sent: true })
  } catch (err) { next(err) }
})

// GET /api/friend-requests/pending — list received pending requests
router.get('/pending', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT fr.*, u.username AS sender_username, u.display_name AS sender_display_name, u.avatar_url AS sender_avatar
       FROM friend_requests fr
       JOIN users u ON u.id = fr.sender_id
       WHERE fr.receiver_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.user.id]
    )
    res.json({ requests: result.rows })
  } catch (err) { next(err) }
})

// GET /api/friend-requests/sent — list sent pending requests
router.get('/sent', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT fr.*, u.username AS receiver_username, u.display_name AS receiver_display_name, u.avatar_url AS receiver_avatar
       FROM friend_requests fr
       JOIN users u ON u.id = fr.receiver_id
       WHERE fr.sender_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.user.id]
    )
    res.json({ requests: result.rows })
  } catch (err) { next(err) }
})

// POST /api/friend-requests/:id/accept
router.post('/:id/accept', authenticate, async (req, res, next) => {
  try {
    const reqRes = await query(
      `UPDATE friend_requests SET status = 'accepted' WHERE id = $1 AND receiver_id = $2 AND status = 'pending' RETURNING *`,
      [req.params.id, req.user.id]
    )
    if (reqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' })
    }
    const fr = reqRes.rows[0]
    await query('INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fr.sender_id, fr.receiver_id])
    await query('INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fr.receiver_id, fr.sender_id])
    res.json({ message: 'Solicitud aceptada', accepted: true })
  } catch (err) { next(err) }
})

// POST /api/friend-requests/:id/reject
router.post('/:id/reject', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE friend_requests SET status = 'rejected' WHERE id = $1 AND receiver_id = $2 AND status = 'pending' RETURNING id`,
      [req.params.id, req.user.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' })
    }
    res.json({ message: 'Solicitud rechazada', rejected: true })
  } catch (err) { next(err) }
})

export default router
