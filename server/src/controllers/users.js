import User from '../models/User.js'
import { query } from '../config/database.js'

// GET /api/users/me
export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      statusText: user.status_text,
      statusEmoji: user.status_emoji,
      isVerified: user.is_verified,
      createdAt: user.created_at,
      allowMessages: user.allow_messages || 'everyone',
      isDiscoverable: user.is_discoverable !== false,
    })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/users/me
export async function updateMe(req, res, next) {
  try {
    const { displayName, statusText, statusEmoji, avatarUrl } = req.body
    const user = await User.updateProfile(req.user.id, { displayName, statusText, statusEmoji, avatarUrl })
    if (!user) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' })
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      statusText: user.status_text,
      statusEmoji: user.status_emoji,
    })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/users/me/privacy
export async function updatePrivacy(req, res, next) {
  try {
    const { allowMessages, isDiscoverable } = req.body
    const fields = []
    const values = []
    let idx = 1

    if (allowMessages !== undefined && ['everyone', 'contacts', 'nobody'].includes(allowMessages)) {
      fields.push(`allow_messages = $${idx++}`)
      values.push(allowMessages)
    }
    if (isDiscoverable !== undefined) {
      fields.push(`is_discoverable = $${idx++}`)
      values.push(!!isDiscoverable)
    }

    if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' })

    values.push(req.user.id)
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING allow_messages, is_discoverable`,
      values
    )
    res.json({
      allowMessages: result.rows[0].allow_messages,
      isDiscoverable: result.rows[0].is_discoverable,
    })
  } catch (err) {
    next(err)
  }
}
