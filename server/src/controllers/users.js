import User from '../models/User.js'

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
    })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/users/me
export async function updateMe(req, res, next) {
  try {
    const { displayName, statusText, statusEmoji } = req.body
    const user = await User.updateProfile(req.user.id, { displayName, statusText, statusEmoji })
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
